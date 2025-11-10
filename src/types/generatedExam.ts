import { Timestamp } from 'firebase/firestore'

export type StoredFileInfo = {
  name: string
  type: 'docx' | 'pdf'
}

export type GeneratedExamRecord = {
  id: string
  userId: string
  title: string
  subject: string
  summary: string
  contents: string
  tipoPreguntas: 'test' | 'desarrollo' | 'mixto'
  numPreguntas: number
  necesidades?: string
  examText: string
  fontFamily: string
  fontSize: number
  sourceMode: 'docx' | 'editor'
  docxText?: string
  editorText?: string
  docxFileName?: string | null
  contenidosFileInfo?: StoredFileInfo | null
  createdAt?: Timestamp | null
  updatedAt?: Timestamp | null
}

export type GeneratedExamInput = Omit<GeneratedExamRecord, 'id' | 'createdAt' | 'updatedAt'>

