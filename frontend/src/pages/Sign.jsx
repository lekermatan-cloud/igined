import React, { useState, useEffect, useCallback } from "react";
import { CheckCircle2, AlertCircle, Loader2, ArrowRight, FileText, X } from "lucide-react";
import PdfViewer from "../components/PdfViewer.jsx";
import SignaturePanel from "../components/SignaturePanel.jsx";

const CONSENT_TEXT_HE = `בחתימתי כאן, אני מצהיר כי המסמך שלפניי הינו אותנטי ומקורי. הנני מסכים/ה לחתום על מסמך זה בחתימה דיגיטלית ומאשר/ת כי קראתי והבנתי את תוכן המסמך. חתימתי מהווה הצהרה חוקית ומחייבת על פי חוק החתימות האלקטרוניות, התשס"א (2001), חוק מסחר אלקטרוני, התשס"א (2000), ESIGN Act (ארה"ב), ו-UETA. החתימה הדיגיטלית שלי מחייבת אותי כאילו חתמתי בכתב יד.`;

const CONSENT_TEXT_EN = `By signing below, I declare that the document presented to me is authentic and original. I agree to sign this document with a digital signature and confirm that I have read and understood its contents. My signature constitutes a legal declaration under the Israeli Electronic Signature Law 5761-2001, Electronic Commerce Law 5761-2000, ESIGN Act (USA), and UETA. My digital signature binds me as if I had signed by hand.`;

const API_BASE = import.meta.env.VITE_API_URL || "https://backend.sigined.com";

export default function SignPage({ token, forceLang }) {
  const [loading, setLoading] = useState(true);
  const [signer, setSigner] = useState(null);
  const [document, setDocument] = useState(null);
  const [fields, setFields] = useState([]);
  const [error, setError] = useState(null);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [signatureType, setSignatureType] = useState("typed");
  const [typedName, setTypedName] = useState("");
  const [drawnSignature, setDrawnSignature] = useState(null);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [forensic, setForensic] = useState({ ip: "", user_agent: "", geolocation: null });
  const [fieldValues, setFieldValues] = useState({});
  const [activeField, setActiveField] = useState(null);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const isEnglish = "en";

  useEffect(() => {
    const fetchSigningData = async () => {
      try {
        const res = await fetch(`${API_BASE}/signing/document?token=${token}`);
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || "Failed to load document");
        }
        
        setSigner(data.signer);
        setDocument(data.document);
        setFields(data.fields || []);
        setTypedName(data.signer?.name || "");
        setFieldValues(data.signer?.field_values || {});
        
        if (data.signer?.status === "signed") {
          setSigned(true);
        }
        
        setForensic({
          ip: "",
          user_agent: navigator.userAgent,
          geolocation: null,
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSigningData();
  }, [token]);

  const handleSignatureChange = useCallback((drawn, typed) => {
    if (drawn) {
      setDrawnSignature(drawn);
    }
  }, []);

  const handleFieldClick = useCallback((field) => {
    if (field.field_type === "signature" || field.field_type === "initials") {
      setActiveField(field);
    } else if (field.field_type === "date") {
      const dateValue = fieldValues[field.id] || new Date().toISOString().split("T")[0];
      setFieldValues((prev) => ({ ...prev, [field.id]: dateValue }));
    } else if (field.field_type === "checkbox") {
      const current = fieldValues[field.id];
      setFieldValues((prev) => ({ ...prev, [field.id]: current === "true" ? "false" : "true" }));
    } else if (field.field_type === "text") {
      setActiveField(field);
      setShowFieldModal(true);
    }
  }, [fieldValues]);

  const handleDrop = useCallback((e, field) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const sigData = JSON.parse(e.dataTransfer.getData("signature"));
      console.log("Drop signature data:", sigData);
      
      const targetField = field || fields.find(f => f.field_type === "signature" && !fieldValues[f.id]);
      if (!targetField) {
        console.log("No signature field available");
        return;
      }
      
      const value = sigData.type === "drawn" ? sigData.value : null;
      const typedValue = sigData.type === "typed" ? sigData.value : null;
      
      setFieldValues((prev) => ({
        ...prev,
        [targetField.id]: value || typedValue,
        [`${targetField.id}_type`]: sigData.type,
      }));
      console.log("Signature placed on field:", targetField.id);
    } catch (err) {
      console.error("Drop error:", err);
    }
  }, [fields, fieldValues]);

  const handleTextSubmit = useCallback((text) => {
    if (activeField) {
      setFieldValues((prev) => ({ ...prev, [activeField.id]: text }));
      setActiveField(null);
      setShowFieldModal(false);
    }
  }, [activeField]);

  const handlePlaceSignature = useCallback(() => {
    const sigFields = fields.filter(
      (f) => (f.field_type === "signature" || f.field_type === "initials") && !fieldValues[f.id]
    );
    
    if (sigFields.length === 0) return;
    
    const sigValue = signatureType === "drawn" ? drawnSignature : null;
    const typedValue = signatureType === "typed" ? typedName : null;
    
    if (!sigValue && !typedValue) return;
    
    setFieldValues((prev) => ({
      ...prev,
      [sigFields[0].id]: sigValue || typedValue,
      [`${sigFields[0].id}_type`]: signatureType,
    }));
  }, [fields, fieldValues, signatureType, drawnSignature, typedName]);

  const getFieldFilledCount = useCallback(() => {
    return fields.filter((f) => {
      const value = fieldValues[f.id];
      return value !== null && value !== undefined && value !== "";
    }).length;
  }, [fields, fieldValues]);

  const canSubmit = useCallback(() => {
    if (!consentAccepted) return false;
    
    const requiredFields = fields.filter((f) => f.is_required);
    const filledRequired = requiredFields.filter((f) => {
      const value = fieldValues[f.id];
      return value !== null && value !== undefined && value !== "";
    });
    
    return filledRequired.length === requiredFields.length;
  }, [consentAccepted, fields, fieldValues]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!canSubmit()) {
      setError("Please fill all required fields and accept the consent terms");
      return;
    }
    
    setSigning(true);
    setError(null);
    
    try {
      const signatureData = drawnSignature?.split(",")[1];
      
      const transformedFieldValues = {};
      for (const [key, value] of Object.entries(fieldValues)) {
        if (fields.find((f) => f.id === key)) {
          transformedFieldValues[key] = value;
        }
      }
      
      const res = await fetch(`${API_BASE}/signing/sign`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          signature_image: signatureData,
          typed_text: signatureType === "typed" ? typedName : undefined,
          field_values: transformedFieldValues,
          consent_text: isEnglish === "en" ? CONSENT_TEXT_EN : CONSENT_TEXT_HE,
          forensic,
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Signing failed");
      }
      
      setSigned(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSigning(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1422] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto mb-4" />
          <p className="text-amber-100/60">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error && !signer) {
    return (
      <div className="min-h-screen bg-[#0f1422] flex items-center justify-center">
        <div className="text-center max-w-md p-8 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl text-red-200 mb-2">Unable to Load Document</h1>
          <p className="text-red-100/60">{error}</p>
        </div>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="min-h-screen bg-[#0f1422] flex items-center justify-center">
        <div className="text-center max-w-md p-8 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
          <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
          <h1 className="text-2xl text-emerald-200 mb-2">
            Document Signed Successfully
          </h1>
          <p className="text-emerald-100/60 mb-6">
            You will receive a confirmation email shortly.
          </p>
          <a
            href="/app/documents"
            className="inline-flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-500 text-black font-medium rounded-lg transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            Back to Documents
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1422]">
      <div className="h-screen flex flex-col">
        <div className="px-4 py-3 bg-black/40 border-b border-amber-900/20 flex items-center justify-between">
          <div>
            <div className="text-amber-50 font-medium">{document?.name}</div>
            <div className="text-amber-100/50 text-sm">
              {getFieldFilledCount()} of {fields.length} fields completed
            </div>
          </div>
          <div className="px-3 py-1 rounded-full bg-amber-600/10 border border-amber-600/30 text-amber-300 text-sm">
            Sigined
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 bg-gray-900 relative" onDragOver={handleDragOver}>
            {document?.file_url ? (
              <PdfViewer
                url={document.file_url}
                fields={fields}
                fieldValues={fieldValues}
                onFieldClick={handleFieldClick}
                onDrop={handleDrop}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-amber-100/50">
                No document preview available
              </div>
            )}
          </div>

          <div className="w-96 bg-[#0f1422] border-l border-amber-900/20 overflow-y-auto p-4">
            <SignaturePanel
              onSignatureChange={handleSignatureChange}
              signatureType={signatureType}
              setSignatureType={setSignatureType}
              typedName={typedName}
              setTypedName={setTypedName}
              isDraggable={true}
            />

            <button
              onClick={handlePlaceSignature}
              disabled={(!drawnSignature && !typedName)}
              className="w-full mt-4 py-2 px-4 rounded-md bg-amber-600/10 text-amber-200 border border-amber-600/30 hover:bg-amber-600/20 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              Place on next signature field
            </button>

            <div className="mt-6 bg-black/20 border border-amber-900/30 rounded-lg p-4">
              <h3 className="text-sm text-amber-200 mb-3">Consent & Agreement</h3>
              <div className="max-h-32 overflow-y-auto p-3 bg-black/30 rounded-lg text-xs text-amber-100/70 leading-relaxed mb-3" dir="ltr">
                {CONSENT_TEXT_EN}
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentAccepted}
                  onChange={(e) => setConsentAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-amber-600 bg-black/40 text-amber-500 focus:ring-amber-500"
                />
                <span className="text-xs text-amber-100/80">
                  I have read, understood, and agree to the terms above.
                </span>
              </label>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-sm mt-4">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={signing || !canSubmit()}
              className="w-full mt-4 py-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-black font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {signing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing...
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5" />
                  Sign Document
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {showFieldModal && activeField && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#0f1422] border border-amber-900/30 rounded-lg p-6 w-96">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg text-amber-50">{activeField.label || "Enter Text"}</h3>
              <button onClick={() => { setShowFieldModal(false); setActiveField(null); }}>
                <X className="w-5 h-5 text-amber-100/50" />
              </button>
            </div>
            <TextInputField
              value={fieldValues[activeField.id] || ""}
              onChange={(text) => handleTextSubmit(text)}
              onSubmit={() => handleTextSubmit(fieldValues[activeField.id] || "")}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function TextInputField({ value, onChange, onSubmit }) {
  return (
    <div className="space-y-4">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter text..."
        className="w-full bg-black/40 border border-amber-900/30 rounded-md px-4 py-3 text-amber-50 placeholder:text-amber-100/30 focus:border-amber-600/60 focus:outline-none"
        autoFocus
      />
      <div className="flex gap-2">
        <button
          onClick={onSubmit}
          className="flex-1 py-2 rounded-md bg-amber-600 hover:bg-amber-500 text-black text-sm"
        >
          Save
        </button>
      </div>
    </div>
  );
}