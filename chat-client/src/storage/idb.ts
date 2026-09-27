import { openDB, type IDBPDatabase } from 'idb'
import type { Conversation } from '../types'

const DB_NAME = 'chat-client'
const DB_VERSION = 1
const STORE = 'conversations'

let dbPromise: Promise<IDBPDatabase> | null = null

export function openDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' })
        }
      },
    })
  }
  return dbPromise
}

export async function listConversations(): Promise<Conversation[]> {
  const db = await openDb()
  const all = await db.getAll(STORE)
  return (all as Conversation[]).sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getConversation(id: string): Promise<Conversation | undefined> {
  const db = await openDb()
  return (await db.get(STORE, id)) as Conversation | undefined
}

export async function putConversation(c: Conversation): Promise<void> {
  const db = await openDb()
  await db.put(STORE, c)
}
