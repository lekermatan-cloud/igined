import { useState, useEffect, useCallback } from "react";
import { api, documents as documentsApi, teams as teamsApi } from "./api.js";
import { MOCK_TEMPLATES, MOCK_TEAM, MOCK_API_KEYS, MOCK_WEBHOOKS } from "./mockData.js";

const isApiAvailable = async () => {
  try {
    const res = await fetch(`${api.baseUrl}/health`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
};

export function useDocuments(ctx) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDocuments = useCallback(async () => {
    if (!ctx.user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await documentsApi.list();
      setDocuments(data.documents || []);
    } catch (err) {
      setError(err.message);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [ctx.user]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return { documents, loading, error, refetch: fetchDocuments };
}

export function useTeams(ctx) {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTeams = useCallback(async () => {
    if (!ctx.user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await teamsApi.list();
      setTeams(data.teams || []);
    } catch {
      setTeams([]);
    } finally {
      setLoading(false);
    }
  }, [ctx.user]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  return { teams, loading, refetch: fetchTeams };
}

export function useUserData(ctx) {
  const [templates] = useState(MOCK_TEMPLATES);
  const [team] = useState(MOCK_TEAM);
  const [apiKeys] = useState(MOCK_API_KEYS);
  const [webhooks] = useState(MOCK_WEBHOOKS);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchDocuments = useCallback(async () => {
    if (!ctx.user) {
      setDocuments([]);
      return;
    }
    setLoading(true);
    try {
      const data = await documentsApi.list();
      setDocuments(data.documents || []);
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [ctx.user]);

  return {
    templates,
    team,
    apiKeys,
    webhooks,
    documents,
    loading,
    fetchDocuments,
  };
}