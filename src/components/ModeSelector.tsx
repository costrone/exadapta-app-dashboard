import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

type Mode = 'adaptive' | 'adapted'

export function ModeSelector({ onSelect }: { onSelect: (mode: Mode) => void }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-2">Bienvenido al Panel Docente</h2>
        <p className="text-gray-600">Elige el tipo de examen que deseas gestionar</p>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onSelect('adaptive')}>
          <div className="text-center space-y-4">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-xl font-semibold">Exámenes Adaptativos</h3>
            <p className="text-gray-600 text-sm">
              Crea y gestiona exámenes adaptativos que se ajustan automáticamente 
              al nivel del alumno durante la realización del examen.
            </p>
            <Button variant="primary" className="w-full mt-4">
              Ir a Exámenes Adaptativos
            </Button>
          </div>
        </Card>

        <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onSelect('adapted')}>
          <div className="text-center space-y-4">
            <div className="text-4xl mb-4">✏️</div>
            <h3 className="text-xl font-semibold">Exámenes Adaptados</h3>
            <p className="text-gray-600 text-sm">
              Genera exámenes personalizados adaptados a las necesidades específicas 
              de tus alumnos usando inteligencia artificial.
            </p>
            <Button variant="primary" className="w-full mt-4">
              Ir a Exámenes Adaptados
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

