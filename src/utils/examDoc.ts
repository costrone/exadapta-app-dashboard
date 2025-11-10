import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  WidthType,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  TabStopType,
} from 'docx'

type QuestionType = 'test' | 'desarrollo' | 'mixto'

type BuildExamDocOptions = {
  examText: string
  subject: string
  fontFamily: string
  fontSize: number
  tipoPreguntas: QuestionType
  createdAt?: Date
}

async function loadImageBytes(path: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(path)
    if (!res.ok) return null
    const blob = await res.blob()
    const buffer = await blob.arrayBuffer()
    return new Uint8Array(buffer)
  } catch {
    return null
  }
}

export async function createExamDoc({
  examText,
  subject,
  fontFamily,
  fontSize,
  tipoPreguntas,
  createdAt = new Date(),
}: BuildExamDocOptions): Promise<Blob> {
  const baseSize = Math.max(8, fontSize) * 2
  const metaSize = Math.max(baseSize - 4, 16)
  const questionSize = baseSize + 4
  const headingSize = baseSize + 6
  const fecha = createdAt.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const children: (Paragraph | Table)[] = []

  const [logoAmBytes, logoSvpBytes] = await Promise.all([
    loadImageBytes('/images/Logoam.png'),
    loadImageBytes('/images/Logosvp.png'),
  ])

  if (logoAmBytes || logoSvpBytes) {
    const cells: TableCell[] = []
    if (logoAmBytes) {
      cells.push(
        new TableCell({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  data: logoAmBytes,
                  transformation: { width: 80, height: 80 },
                } as any),
              ],
            }),
          ],
          width: { size: logoSvpBytes ? 50 : 100, type: WidthType.PERCENTAGE },
        })
      )
    }
    if (logoSvpBytes) {
      cells.push(
        new TableCell({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  data: logoSvpBytes,
                  transformation: { width: 80, height: 80 },
                } as any),
              ],
            }),
          ],
          width: { size: logoAmBytes ? 50 : 100, type: WidthType.PERCENTAGE },
        })
      )
    }

    children.push(
      new Table({
        width: {
          size: 100,
          type: WidthType.PERCENTAGE,
        },
        rows: [
          new TableRow({
            children: cells,
          }),
        ],
      })
    )
    children.push(
      new Paragraph({
        text: '',
        spacing: { after: 120 },
      })
    )
  }

  children.push(
    new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: 9000 }],
      children: [
        new TextRun({
          text: 'NOMBRE:',
          bold: true,
          font: fontFamily,
          size: metaSize,
        }),
        new TextRun({
          text: ' ______________________________',
          font: fontFamily,
          size: metaSize,
        }),
        new TextRun({
          text: '\t',
          font: fontFamily,
          size: metaSize,
        }),
        new TextRun({
          text: subject || '',
          font: fontFamily,
          size: metaSize,
        }),
      ],
      spacing: { after: 200 },
    })
  )

  children.push(
    new Paragraph({
      text: '',
      spacing: { after: 200 },
    })
  )

  children.push(
    new Paragraph({
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: `Fecha: ${fecha}`,
          font: fontFamily,
          size: metaSize,
          italics: true,
          color: '666666',
        }),
      ],
    })
  )

  if (tipoPreguntas === 'test' && examText.includes('Respuesta correcta')) {
    const questions = examText.split(/\n(?=\d+\.)/).filter((q) => q.trim())
    questions.forEach((question, idx) => {
      const lines = question.split('\n').filter((l) => l.trim())
      if (lines.length === 0) return
      const questionLine = lines[0]
      const questionText = questionLine.replace(/^\d+\.\s*/, '')

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${idx + 1}. `,
              bold: true,
              size: questionSize,
              color: '004379',
              font: fontFamily,
            }),
            new TextRun({
              text: questionText,
              bold: true,
              size: questionSize,
              font: fontFamily,
            }),
          ],
          spacing: { before: 240, after: 160 },
        })
      )

      const options = lines
        .slice(1)
        .filter((l) => !l.includes('Respuesta correcta:'))
      options.forEach((option) => {
        const trimmedOption = option.trim()
        const match = trimmedOption.match(/^([A-D])[\.\)]\s*(.+)$/)
        if (match) {
          const [, letter, text] = match
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${letter}. `,
                  bold: true,
                  size: baseSize,
                  color: '333333',
                  font: fontFamily,
                }),
                new TextRun({
                  text,
                  size: baseSize,
                  font: fontFamily,
                }),
              ],
              spacing: { after: 120 },
              indent: { left: 720 },
            })
          )
        } else {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: trimmedOption,
                  size: baseSize,
                  font: fontFamily,
                }),
              ],
              spacing: { after: 120 },
              indent: { left: 720 },
            })
          )
        }
      })

      children.push(
        new Paragraph({
          text: '',
          spacing: { after: 200 },
        })
      )
    })
  } else {
    const paragraphs = examText.split('\n').filter((p) => p.trim())
    paragraphs.forEach((para, idx) => {
      const trimmedPara = para.trim()
      if (!trimmedPara) return
      const isTitle =
        trimmedPara.length < 80 &&
        !trimmedPara.includes('.') &&
        idx < paragraphs.length - 1

      if (isTitle) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmedPara,
                bold: true,
                size: headingSize,
                color: '004379',
                font: fontFamily,
              }),
            ],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 200 },
          })
        )
      } else {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmedPara,
                size: baseSize,
                font: fontFamily,
              }),
            ],
            spacing: { after: 150 },
          })
        )
      }
    })
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children,
      },
    ],
  })

  return Packer.toBlob(doc)
}

