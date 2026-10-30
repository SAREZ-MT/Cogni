import type { Metadata } from "next";
import { LegalPage } from "../_components/legal-page";
import { legalPage } from "../_lib/legal-documents";

export const metadata: Metadata = {
  title: "Derechos de autor | Cogni",
  description: legalPage("derechos-de-autor").description,
};

export default function Page() {
  return <LegalPage slug="derechos-de-autor" />;
}
