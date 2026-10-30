import type { Metadata } from "next";
import { LegalPage } from "../_components/legal-page";
import { legalPage } from "../_lib/legal-documents";

export const metadata: Metadata = {
  title: "Uso aceptable e IA | Cogni",
  description: legalPage("uso-aceptable").description,
};

export default function Page() {
  return <LegalPage slug="uso-aceptable" />;
}
