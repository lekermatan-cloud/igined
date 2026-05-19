import React, { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, Loader2, FileText, Shield, Hash, Clock, UserCheck, XCircle } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "https://backend.sigined.com";

export default function VerifyPage({ publicId }) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!publicId) {
      setError("No verification ID provided");
      setLoading(false);
      return;
    }

    const verify = async () => {
      try {
        const res = await fetch(`${API_BASE}/signing/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_id: publicId }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Verification failed");
        }

        setResult(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [publicId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1422] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-amber-500 mx-auto mb-4" />
          <p className="text-amber-100/60">Verifying document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0f1422] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-amber-50 mb-2">Verification Failed</h1>
          <p className="text-amber-100/60 mb-6">{error}</p>
          <div className="bg-white/5 border border-amber-900/20 rounded-lg p-4">
            <p className="text-xs text-amber-100/40 font-mono">ID: {publicId}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!result?.valid) {
    return (
      <div className="min-h-screen bg-[#0f1422] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-amber-50 mb-2">Document Not Found</h1>
          <p className="text-amber-100/60 mb-6">{result?.message || "This document could not be verified in the registry."}</p>
          <div className="bg-white/5 border border-amber-900/20 rounded-lg p-4">
            <p className="text-xs text-amber-100/40 font-mono">ID: {publicId}</p>
          </div>
        </div>
      </div>
    );
  }

  const { document: doc, certificate: cert } = result;

  return (
    <div className="min-h-screen bg-[#0f1422] flex items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 mb-4">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-semibold text-amber-50 mb-1">Document Verified</h1>
          <p className="text-amber-100/60 text-sm">This document is registered in the Sigined certificate registry</p>
        </div>

        <div className="bg-white/5 border border-amber-900/20 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-amber-900/20 bg-white/[0.02]">
            <h2 className="text-sm font-medium text-amber-200 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Document
            </h2>
          </div>
          <div className="p-5 space-y-3">
            <div className="flex justify-between items-start">
              <span className="text-amber-100/50 text-sm">Name</span>
              <span className="text-amber-100 text-sm font-medium text-right">{doc?.name || "Unknown"}</span>
            </div>
            {doc?.type && (
              <div className="flex justify-between items-start">
                <span className="text-amber-100/50 text-sm">Type</span>
                <span className="text-amber-100 text-sm">{doc.type}</span>
              </div>
            )}
            {doc?.size_bytes && (
              <div className="flex justify-between items-start">
                <span className="text-amber-100/50 text-sm">Size</span>
                <span className="text-amber-100 text-sm">{(doc.size_bytes / 1024).toFixed(1)} KB</span>
              </div>
            )}
            {doc?.completed_at && (
              <div className="flex justify-between items-start">
                <span className="text-amber-100/50 text-sm">Completed</span>
                <span className="text-amber-100 text-sm">{new Date(doc.completed_at).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white/5 border border-amber-900/20 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-amber-900/20 bg-white/[0.02]">
            <h2 className="text-sm font-medium text-amber-200 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Certificate
            </h2>
          </div>
          <div className="p-5 space-y-3">
            <div className="flex justify-between items-start">
              <span className="text-amber-100/50 text-sm flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5" />
                Hash
              </span>
              <span className="text-amber-100 text-xs font-mono max-w-[200px] truncate text-right" title={cert?.hash}>
                {cert?.hash?.substring(0, 24)}...
              </span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-amber-100/50 text-sm flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Issued
              </span>
              <span className="text-amber-100 text-sm">{cert?.issued_at ? new Date(cert.issued_at).toLocaleString() : "Unknown"}</span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-amber-100/50 text-sm flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" />
                Compliance
              </span>
              <span className={`text-sm font-medium capitalize ${
                cert?.compliance_level === "qualified" ? "text-emerald-400" :
                cert?.compliance_level === "advanced" ? "text-amber-400" :
                "text-amber-100/60"
              }`}>
                {cert?.compliance_level || "Unknown"}
              </span>
            </div>
            {cert?.has_tsa_timestamp && (
              <div className="flex justify-between items-start">
                <span className="text-amber-100/50 text-sm">TSA Timestamp</span>
                <span className="text-emerald-400 text-sm flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Verified
                </span>
              </div>
            )}
            {cert?.tsa_authority && (
              <div className="flex justify-between items-start">
                <span className="text-amber-100/50 text-sm">TSA Authority</span>
                <span className="text-amber-100 text-sm text-right max-w-[200px] truncate">{cert.tsa_authority}</span>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-amber-100/30 font-mono">
          Sigined Certificate Registry &middot; SHA-256 &middot; UTC
        </p>

        <div className="text-center">
          <a
            href="/"
            className="inline-block text-xs text-amber-500/60 hover:text-amber-400 transition-colors"
          >
            &larr; Back to Sigined
          </a>
        </div>
      </div>
    </div>
  );
}
