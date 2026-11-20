import crypto from "node:crypto";
import dicomParser from "dicom-parser";

export type DeidFinding = { tag: string; name: string; action: "removed" | "remapped" | "flagged" };

type Element = dicomParser.Element;
type DataSet = dicomParser.DataSet;

/** Tags whose values are wiped (replaced by blanks of identical length so the file stays valid). */
const WIPE: Record<string, string> = {
  x00080050: "AccessionNumber", x00080080: "InstitutionName", x00080081: "InstitutionAddress",
  x00080090: "ReferringPhysicianName", x00080092: "ReferringPhysicianAddress", x00080094: "ReferringPhysicianTelephone",
  x00081010: "StationName", x00081030: "StudyDescription", x00081040: "InstitutionalDepartmentName",
  x00081048: "PhysiciansOfRecord", x00081050: "PerformingPhysicianName", x00081060: "NameOfPhysiciansReadingStudy",
  x00081070: "OperatorsName", x00100010: "PatientName", x00100020: "PatientID", x00100030: "PatientBirthDate",
  x00100032: "PatientBirthTime", x00100050: "PatientInsurancePlan", x00101000: "OtherPatientIDs",
  x00101001: "OtherPatientNames", x00101002: "OtherPatientIDsSequence", x00101005: "PatientBirthName",
  x00101040: "PatientAddress", x00101060: "PatientMotherBirthName", x00102154: "PatientTelephoneNumbers",
  x00104000: "PatientComments", x00181000: "DeviceSerialNumber", x00200010: "StudyID", x00204000: "ImageComments",
  x00080020: "StudyDate", x00080021: "SeriesDate", x00080022: "AcquisitionDate", x00080023: "ContentDate",
  x00080030: "StudyTime", x00080031: "SeriesTime", x00080032: "AcquisitionTime", x00080033: "ContentTime",
  x0008002a: "AcquisitionDateTime", x00321032: "RequestingPhysician", x00400006: "ScheduledPerformingPhysicianName",
  x00401001: "RequestedProcedureID", x00400253: "PerformedProcedureStepID", x00400254: "PerformedProcedureStepDescription",
};

/** UIDs are replaced by deterministic same-length pseudonyms so series/study grouping survives. */
const REMAP_UID: Record<string, string> = {
  x0020000d: "StudyInstanceUID", x0020000e: "SeriesInstanceUID", x00080018: "SOPInstanceUID", x00200052: "FrameOfReferenceUID",
};

const UNCOMPRESSED_TS = new Set(["1.2.840.10008.1.2", "1.2.840.10008.1.2.1", "1.2.840.10008.1.2.2"]);

const salt = () => process.env.AUTH_SECRET ?? "dev";

function pseudonymUid(orig: string, length: number) {
  const prefix = "2.25.";
  const room = length - prefix.length;
  if (room < 4) return null;
  const digits = BigInt("0x" + crypto.createHash("sha256").update(salt() + orig).digest("hex")).toString().padEnd(room, "7");
  return prefix + ("1" + digits).slice(0, room); // leading non-zero digit keeps the UID component valid
}

const hex = (t: string) => t.toUpperCase().replace("X", "x").toLowerCase();

function walk(ds: DataSet, buf: Uint8Array, findings: DeidFinding[]) {
  for (const [tag, el] of Object.entries(ds.elements) as [string, Element][]) {
    const key = hex(tag);
    if (el.items) {
      if (WIPE[key]) findings.push({ tag: key, name: WIPE[key], action: "removed" });
      // Nested datasets may carry identifiers too (e.g. referenced studies): recurse.
      for (const item of el.items) if (item.dataSet) walk(item.dataSet, buf, findings);
      continue;
    }
    const len = el.length;
    if (!len || len <= 0 || el.dataOffset === undefined) continue;
    const isPN = el.vr === "PN";
    if (WIPE[key] || isPN) {
      const hadValue = buf.subarray(el.dataOffset, el.dataOffset + len).some((b) => b !== 0x20 && b !== 0);
      buf.fill(0x20, el.dataOffset, el.dataOffset + len);
      if (hadValue) findings.push({ tag: key, name: WIPE[key] ?? "PersonName", action: "removed" });
    } else if (REMAP_UID[key]) {
      const orig = String.fromCharCode(...buf.subarray(el.dataOffset, el.dataOffset + len)).replace(/\0/g, "").trim();
      const next = pseudonymUid(orig, len);
      if (next) {
        for (let i = 0; i < len; i++) buf[el.dataOffset + i] = i < next.length ? next.charCodeAt(i) : 0;
        findings.push({ tag: key, name: REMAP_UID[key], action: "remapped" });
      }
    }
  }
}

export type DicomResult = {
  data: Buffer;
  findings: DeidFinding[];
  burnedInSuspected: boolean;
  supported: boolean;
  meta: Record<string, string | number | null>;
};

/** Parse, de-identify (in place on a copy) and verify a DICOM file. Throws on invalid DICOM. */
export function deidentifyDicom(input: Buffer): DicomResult {
  const copy = new Uint8Array(input); // copy: never mutate the caller's buffer
  const ds = dicomParser.parseDicom(copy);
  const findings: DeidFinding[] = [];

  // Capture technical metadata BEFORE blanking, but only non-identifying fields.
  const str = (t: string) => ds.string(t)?.trim() || null;
  const ts = str("x00020010");
  const pos = ds.string("x00200032")?.split("\\").map(Number);
  const meta: DicomResult["meta"] = {
    modality: str("x00080060"), rows: ds.uint16("x00280010") ?? null, columns: ds.uint16("x00280011") ?? null,
    frames: Number(str("x00280008") ?? 1), bitsAllocated: ds.uint16("x00280100") ?? null,
    bitsStored: ds.uint16("x00280101") ?? null, pixelRepresentation: ds.uint16("x00280103") ?? 0,
    samples: ds.uint16("x00280002") ?? 1, photometric: str("x00280004"),
    windowCenter: ds.floatString("x00281050") ?? null, windowWidth: ds.floatString("x00281051") ?? null,
    rescaleSlope: ds.floatString("x00281053") ?? 1, rescaleIntercept: ds.floatString("x00281052") ?? 0,
    instanceNumber: ds.intString("x00200013") ?? null, zPos: pos && pos.length === 3 ? pos[2] : null,
    sliceThickness: str("x00180050"), pixelSpacing: str("x00280030"), seriesDescription: str("x0008103e"),
    bodyPart: str("x00180015"), transferSyntax: ts, planar: ds.uint16("x00280006") ?? 0,
  };

  walk(ds, copy, findings);

  const burnedIn = str("x00280301")?.toUpperCase() === "YES";
  const sc = (str("x00080016") ?? "").startsWith("1.2.840.10008.5.1.4.1.1.7"); // Secondary Capture often has burned-in text
  const us = meta.modality === "US";
  if (burnedIn || sc || us) {
    findings.push({ tag: "pixel", name: "Possible burned-in annotations", action: "flagged" });
  }

  // Verify: re-parse the sanitised bytes and ensure the identifying tags are blank.
  const check = dicomParser.parseDicom(copy);
  for (const t of ["x00100010", "x00100020", "x00100030", "x00080050"]) {
    if (check.string(t)?.trim()) throw new Error("De-identification verification failed");
  }

  return {
    data: Buffer.from(copy),
    findings,
    burnedInSuspected: burnedIn || sc || us,
    supported: ts ? UNCOMPRESSED_TS.has(ts) : true,
    meta,
  };
}
