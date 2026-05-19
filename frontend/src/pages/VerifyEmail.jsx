import React, { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, Loader2, Mail } from "lucide-react";
import { auth as authApi } from "../api.js";

export default function VerifyEmailPage() {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const token = params.get("token");

  const [status, setStatus] = useState("verifying");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token provided");
      return;
    }

    const verify = async () => {
      try {
        const data = await authApi.verifyEmail(token);
        setStatus("success");
        setMessage(data.message || "Email verified successfully!");
      } catch (err) {
        setStatus("error");
        setMessage(err.message || "Verification failed");
      }
    };

    verify();
  }, [token]);

  return (
    <div className="min-h-screen bg-[#0f1422] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {status === "verifying" && (
          <>
            <Loader2 className="w-16 h-16 animate-spin text-amber-500 mx-auto mb-4" />
            <h1 className="text-2xl font-semibold text-amber-50 mb-2">Verifying your email...</h1>
          </>
        )}

        {status === "success" && (
          <>
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 mb-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-semibold text-amber-50 mb-2">Email Verified!</h1>
            <p className="text-amber-100/60 mb-6">{message}</p>
            <a
              href="/app"
              className="inline-block px-6 py-3 bg-amber-600 hover:bg-amber-500 text-black font-medium rounded-md transition-colors"
            >
              Go to Dashboard
            </a>
          </>
        )}

        {status === "error" && (
          <>
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-semibold text-amber-50 mb-2">Verification Failed</h1>
            <p className="text-amber-100/60 mb-2">{message}</p>
            <p className="text-sm text-amber-100/40 mb-6">
              The link may have expired. You can request a new verification email from your settings.
            </p>
            <a
              href="/app"
              className="inline-block px-6 py-3 bg-amber-600 hover:bg-amber-500 text-black font-medium rounded-md transition-colors"
            >
              Go to Dashboard
            </a>
          </>
        )}

        <div className="mt-8 text-center">
          <a href="/" className="text-xs text-amber-500/60 hover:text-amber-400 transition-colors">
            &larr; Back to Sigined
          </a>
        </div>
      </div>
    </div>
  );
}
