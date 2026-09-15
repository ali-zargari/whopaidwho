"use client";
import { createContext, useContext, useState } from "react";
import type { Candidate } from "@/lib/types";
type Selection = {
  selected: Candidate[];
  setSelected: React.Dispatch<React.SetStateAction<Candidate[]>>;
};
const Context = createContext<Selection | null>(null);
export default function CompareProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [selected, setSelected] = useState<Candidate[]>([]);
  return <Context value={{ selected, setSelected }}>{children}</Context>;
}
export function useComparison() {
  const value = useContext(Context);
  if (!value) throw Error("Comparison provider missing");
  return value;
}
