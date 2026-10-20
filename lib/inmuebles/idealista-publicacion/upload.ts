import { Readable } from "node:stream";
import { Client } from "basic-ftp";

export async function subirJsonIdealistaFtp(input: {
  host: string;
  port: number;
  user: string;
  password: string;
  secure: boolean;
  customerCode: string;
  json: string;
}): Promise<{ fileName: string }> {
  const client = new Client(30_000);
  client.ftp.verbose = false;
  const fileName = `${input.customerCode.toLowerCase()}-rehabinco.json`;
  try {
    await client.access({
      host: input.host,
      port: input.port,
      user: input.user,
      password: input.password,
      secure: input.secure,
    });
    const buf = Buffer.from(input.json, "utf8");
    await client.uploadFrom(Readable.from(buf), fileName);
    return { fileName };
  } finally {
    client.close();
  }
}
