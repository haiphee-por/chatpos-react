import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'node:stream';
import { createRequire } from 'node:module';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const require = createRequire(import.meta.url);
const { handleApiRequest } = require('../../../lib/server/api-handler.cjs');

type CollectedResponse = {
  status: number;
  headers: Headers;
  chunks: Buffer[];
  ended: boolean;
  onEnd: Promise<void>;
  resolveEnd: () => void;
};

function createNodeReq(request: NextRequest, body: Buffer): NodeJS.ReadableStream & {
  headers: Record<string, string>;
  method: string;
  url: string;
  socket: { remoteAddress: string };
} {
  const stream = Readable.from(body.length ? [body] : []);
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  const pathAndQuery = request.nextUrl.pathname + (request.nextUrl.search || '');
  const nodeReq = stream as any;
  nodeReq.headers = headers;
  nodeReq.method = request.method;
  nodeReq.url = pathAndQuery;
  nodeReq.socket = {
    remoteAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
  };
  return nodeReq;
}

function createNodeRes(): CollectedResponse & {
  statusCode: number;
  setHeader(name: string, value: string | string[]): void;
  getHeader(name: string): string | string[] | undefined;
  removeHeader(name: string): void;
  writeHead(status: number, headers?: Record<string, string>): void;
  write(chunk: string | Buffer): boolean;
  end(chunk?: string | Buffer): void;
} {
  const collected: CollectedResponse = {
    status: 200,
    headers: new Headers(),
    chunks: [],
    ended: false,
    onEnd: Promise.resolve(),
    resolveEnd: () => {},
  };
  collected.onEnd = new Promise<void>((resolve) => {
    collected.resolveEnd = resolve;
  });
  const res = collected as any;
  res.statusCode = 200;
  res.setHeader = (name: string, value: string | string[]) => {
    if (Array.isArray(value)) {
      collected.headers.delete(name);
      for (const item of value) collected.headers.append(name, item);
    } else {
      collected.headers.set(name, value);
    }
  };
  res.getHeader = (name: string) => collected.headers.get(name) ?? undefined;
  res.removeHeader = (name: string) => collected.headers.delete(name);
  res.writeHead = (status: number, headers?: Record<string, string>) => {
    collected.status = status;
    res.statusCode = status;
    if (headers) for (const [key, value] of Object.entries(headers)) collected.headers.set(key, value);
  };
  res.write = (chunk: string | Buffer) => {
    collected.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return true;
  };
  res.end = (chunk?: string | Buffer) => {
    if (chunk !== undefined) {
      collected.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    collected.status = res.statusCode || collected.status;
    collected.ended = true;
    collected.resolveEnd();
  };
  return res;
}

async function dispatch(request: NextRequest): Promise<NextResponse> {
  const body = Buffer.from(await request.arrayBuffer());
  const nodeReq = createNodeReq(request, body);
  const nodeRes = createNodeRes();
  handleApiRequest(nodeReq, nodeRes).catch((error: Error) => {
    console.error('[Route Adapter] Uncaught error:', error);
    if (!nodeRes.ended) {
      nodeRes.statusCode = 500;
      nodeRes.end(JSON.stringify({ success: false, code: 'INTERNAL_ERROR', error: error.message }));
    }
  });
  await nodeRes.onEnd;
  const bodyBuffer = Buffer.concat(nodeRes.chunks);
  return new NextResponse(bodyBuffer.length ? bodyBuffer : null, {
    status: nodeRes.status,
    headers: nodeRes.headers,
  });
}

export async function GET(request: NextRequest) {
  return dispatch(request);
}
export async function POST(request: NextRequest) {
  return dispatch(request);
}
export async function PUT(request: NextRequest) {
  return dispatch(request);
}
export async function PATCH(request: NextRequest) {
  return dispatch(request);
}
export async function DELETE(request: NextRequest) {
  return dispatch(request);
}
export async function OPTIONS(request: NextRequest) {
  return dispatch(request);
}
export async function HEAD(request: NextRequest) {
  return dispatch(request);
}
