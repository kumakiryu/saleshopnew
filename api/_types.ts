import type { IncomingMessage, ServerResponse } from 'http';

export interface VercelRequest extends IncomingMessage {
  query: Record<string, string | string[]>;
  cookies: Record<string, string>;
  body: any;
}

export interface VercelResponse extends ServerResponse {
  send(body: any): VercelResponse;
  json(body: any): VercelResponse;
  status(code: number): VercelResponse;
  redirect(url: string): VercelResponse;
  redirect(status: number, url: string): VercelResponse;
}
