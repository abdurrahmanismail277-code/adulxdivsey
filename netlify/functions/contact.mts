import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { contacts } from "../../db/schema.js";

export default async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: { name?: string; phone?: string; email?: string; course?: string; billing?: string; amount?: number };

  try {
    body = await req.json();
  } catch {
    return Response.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const { name, phone, email, course, billing, amount } = body;

  if (!name || !phone || !email || !course || !billing || amount === undefined) {
    return Response.json({ message: "All fields are required" }, { status: 400 });
  }

  const id = crypto.randomUUID();

  await db.insert(contacts).values({ id, name, phone, email, course, billing, amount });

  return Response.json({ applicationId: id }, { status: 201 });
};

export const config: Config = {
  path: "/api/contact",
  method: "POST",
};
