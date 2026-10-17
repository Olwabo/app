import axios from "axios";
import { supabase } from "./supabase";

export const API_BASE = `${process.env.REACT_APP_BACKEND_URL}/api`;
export const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use(async (cfg) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export const errMsg = (e) => {
  const d = e?.response?.data?.detail;
  if (Array.isArray(d)) return d.map((x) => `${x.loc?.slice(-1)[0] ?? ""}: ${x.msg}`).join(", ");
  return d || e?.message || "Something went wrong";
};
