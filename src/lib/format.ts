import type { Candidate } from "./types";
export const money = (value: number, compact = false) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
    minimumFractionDigits: 0,
  }).format(value);
export const number = (value: number) =>
  new Intl.NumberFormat("en-US").format(value);
export const date = (value: string | null) =>
  value
    ? new Date(value.slice(0, 10) + "T12:00:00Z").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : "Not reported";
export const partyName = (party: string) =>
  ({
    DEM: "Democrat",
    REP: "Republican",
    IND: "Independent",
    LIB: "Libertarian",
    GRE: "Green",
  })[party] ||
  party ||
  "Other";
export const partyClass = (party: string) =>
  party === "DEM" ? "dem" : party === "REP" ? "rep" : "other";
export const officeLabel = (c: Candidate) =>
  c.office === "senate"
    ? "U.S. Senate"
    : `U.S. House · ${!c.district ? "District not reported" : c.district === "00" ? "At-large" : `District ${Number(c.district)}`}`;
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .filter((n) => !["Mr.", "Ms.", "Mrs.", "Dr."].includes(n))
    .slice(0, 2)
    .map((n) => n[0])
    .join("");
export const contributionTotal = (c: Candidate) =>
  c.individuals + c.committees + c.partyContributions + c.selfContributions;
export const fecUrl = (c: Candidate) =>
  `https://www.fec.gov/data/candidate/${c.id}/?cycle=${c.cycle}&election_full=false`;
export const STATES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  AS: "American Samoa",
  GU: "Guam",
  MP: "Northern Mariana Islands",
  PR: "Puerto Rico",
  VI: "U.S. Virgin Islands",
};

export const currentCycle = (year = new Date().getUTCFullYear()) =>
  year % 2 === 0 ? year : year + 1;

export const coverage = (c: Candidate) =>
  c.coverageDateAnomaly
    ? `Source date ${date(c.coverageEnd)} is after retrieval; verify the filing`
    : c.coverageEnd
      ? `Reported through ${date(c.coverageEnd)}`
      : "Reporting date not available";
