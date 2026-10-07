import type { Request, Response } from "express";
import app from "../server/app";

export default function handler(req: Request, res: Response) {
  const url = new URL(req.url, "http://localhost");
  const taskPath = url.searchParams.get("taskPath");
  if (taskPath) {
    url.searchParams.delete("taskPath");
    req.url = `/api/${taskPath}${url.search}`;
  }
  return app(req, res);
}
