import { useState } from "react";
import { FontLoader } from "./components/Shared";
import LandingPage from "./components/LandingPage";
import FormPage from "./components/FormPage";
import CaseDashboard from "./components/CaseDashboard";

export default function App() {
  const [page, setPage] = useState("landing");
  const [caseData, setCaseData] = useState(null);

  const handleCaseLoaded = (data, cnr) => {
    setCaseData(data);
  };

  return (
    <>
      <FontLoader />
      {page === "landing" && <LandingPage setPage={setPage} />}
      {page === "form" && (
        <FormPage setPage={setPage} onCaseLoaded={handleCaseLoaded} />
      )}
      {page === "case" && caseData && (
        <CaseDashboard setPage={setPage} caseData={caseData} />
      )}
      {page === "case" && !caseData && (
        <FormPage setPage={setPage} onCaseLoaded={handleCaseLoaded} />
      )}
    </>
  );
}
