import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as core from "./schema";
import * as sinapse from "./schema-sinapse";

// Schema combinado: 39 tabelas Nexial + 8 tabelas Sinapse.
// Mantemos arquivos separados para isolar o modulo neural sem mexer no nucleo.
const schema = { ...core, ...sinapse };

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });

export { schema };
