/**
 * Course code -> School/Department, sourced from Schools_of_ICMHS.xlsx
 * (Code, Programme, School/Department columns). Regenerate this file the
 * same way if the school adds programmes or reassigns one to a different
 * department — keys are the exact codes from that sheet, uppercased.
 */
export const DEPARTMENT_BY_COURSE_CODE: Record<string, string> = {
  DPTT: "School of Perioperative Theatre Technology",
  CPTT: "School of Perioperative Theatre Technology",
  DPTTT: "School of Perioperative Theatre Technology",
  CHRIT: "School of Health Records & Information Technology",
  KRCHN: "School of Nursing",
  DSL: "School of Applied Sciences",
  CSL: "School of Applied Sciences",
  CHSS: "School of Health and Social Sciences",
  DHRIT: "School of Health Records & Information Technology",
  DME: "School of Applied Sciences",
  DCHA: "School of Health and Social Sciences",
  CCHA: "School of Health and Social Sciences",
  DHRITT: "School of Health Records & Information Technology",
  CHN: "School of Human Nutrition and Dietetics",
  AHSS: "School of Health and Social Sciences",
  CGC: "School of Health and Social Sciences",
  DCMS: "School of Clinical Medicine and Surgery",
  CCHD: "School of Health and Social Sciences",
  DHN: "School of Human Nutrition and Dietetics",
  DBMET: "School of Applied Sciences",
  DCHD: "School of Health and Social Sciences",
  DCHDT: "School of Health and Social Sciences",
  CCH: "School of Health and Social Sciences",
  DCHAT: "School of Health and Social Sciences",
  DSLT: "School of Applied Sciences",
  CND: "School of Human Nutrition and Dietetics",
  CHSA: "School of Health and Social Sciences",
  DHNT: "School of Human Nutrition and Dietetics",
  DND: "School of Human Nutrition and Dietetics",
  CHSST: "School of Health and Social Sciences",
  CCDS: "School of Health and Social Sciences",
  DCDS: "School of Health and Social Sciences",
  DCH: "School of Health and Social Sciences",
  DIT: "School of Health Records & Information Technology",
  CHSAT: "School of Health and Social Sciences",
  CPH: "Other",
  DCP: "School of Health and Social Sciences",
  DNDT: "School of Human Nutrition and Dietetics",
  CCP: "School of Health and Social Sciences",
  DCHH: "School of Health and Social Sciences",
  CIT: "School of Health Records & Information Technology",
  CPTTT: "School of Perioperative Theatre Technology",
  DCDST: "School of Health and Social Sciences",
  CP: "School of Health Records & Information Technology",
  DAB: "School of Applied Sciences",
  DCPT: "School of Health and Social Sciences",
  DFP: "School of Human Nutrition and Dietetics",
  CBMET: "School of Applied Sciences",
  DABT: "School of Applied Sciences",
  DES: "School of Applied Sciences",
  CFB: "School of Human Nutrition and Dietetics",
  NS: "Other",
  CFP: "School of Human Nutrition and Dietetics",
  DCHHT: "School of Health and Social Sciences",
  CS: "School of Health and Social Sciences",
  CCHDT: "School of Health and Social Sciences",
  DFB: "School of Human Nutrition and Dietetics",
  DFPT: "School of Human Nutrition and Dietetics",
  DPT: "Other",
  IMM: "Other",
  PC: "Other",
};

/** Every department name in the map, in a sensible fixed display order. */
export const DEPARTMENTS: string[] = [
  "School of Nursing",
  "School of Clinical Medicine and Surgery",
  "School of Perioperative Theatre Technology",
  "School of Health and Social Sciences",
  "School of Health Records & Information Technology",
  "School of Human Nutrition and Dietetics",
  "School of Applied Sciences",
  "Other",
];

/**
 * Looks up a student's department from their course code. Falls back to
 * "Unassigned" (not "Other" — "Other" is a real category in the source
 * sheet) for any code not present in the map, e.g. a brand-new programme
 * that hasn't been added to Schools_of_ICMHS.xlsx yet.
 */
export function getDepartment(courseCode: string): string {
  const key = (courseCode || "").trim().toUpperCase();
  return DEPARTMENT_BY_COURSE_CODE[key] ?? "Unassigned";
}
