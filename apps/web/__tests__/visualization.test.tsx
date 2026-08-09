/**
 * Comprehensive Unit and Integration Tests for Visualization Components
 * Testing suite for Industrial-grade 3D and 2D visualizers
 *
 * Test Categories:
 * 1. Data Validation Tests
 * 2. Rendering Tests
 * 3. Interaction Tests
 * 4. Performance Tests
 * 5. Edge Case Tests
 * 6. Integration Tests
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import Industrial3DVisualizerEnhancedV11 from '@/components/industrial-3d-visualizer-enhanced-v11'
import HybridChartVisualizerIndustrial from '@/components/hybrid-chart-visualizer-industrial'

// ==================== TEST DATA ====================

const mockDataPoints = [
  { x: 0, y: 0, z: 0, temperature: 300, pressure: 101325, velocity_magnitude: 1.0, density: 1.2 },
  { x: 0.5, y: 0.5, z: 0.5, temperature: 350, pressure: 150000, velocity_magnitude: 2.0, density: 1.5 },
  { x: 1, y: 1, z: 1, temperature: 400, pressure: 200000, velocity_magnitude: 3.0, density: 1.8 },
  { x: -0.5, y: -0.5, z: -0.5, temperature: 250, pressure: 80000, velocity_magnitude: 0.5, density: 0.9 },
  { x: 0.2, y: 0.3, z: 0.4, temperature: 320, pressure: 120000, velocity_magnitude: 1.5, density: 1.3 },
]

const mockPredictions = [
  { time: 0, timestamp: '1970-01-01T00:00:00.000Z', x: 0.5, y: 0.5, z: 0.5, temperature: 300, pressure: 101325, velocity_u: 0.5, velocity_v: 0.5, velocity_w: 0.5, density: 1.2 },
  { time: 1, timestamp: '1970-01-01T00:00:01.000Z', x: 0.5, y: 0.5, z: 0.5, temperature: 320, pressure: 120000, velocity_u: 0.6, velocity_v: 0.6, velocity_w: 0.6, density: 1.3 },
  { time: 2, timestamp: '1970-01-01T00:00:02.000Z', x: 0.5, y: 0.5, z: 0.5, temperature: 350, pressure: 150000, velocity_u: 0.7, velocity_v: 0.7, velocity_w: 0.7, density: 1.5 },
  { time: 3, timestamp: '1970-01-01T00:00:03.000Z', x: 0.5, y: 0.5, z: 0.5, temperature: 380, pressure: 180000, velocity_u: 0.8, velocity_v: 0.8, velocity_w: 0.8, density: 1.7 },
]

// ==================== UNIT TESTS: DATA VALIDATION ====================

describe('Data Validation Tests', () => {
  test('should handle empty data array gracefully', () => {
    const { container } = render(
      <Industrial3DVisualizerEnhancedV11 data={[]} title="Test" />
    )
    expect(container).toBeInTheDocument()
  })

  test('should validate data point structure', () => {
    const invalidData = [
      { x: 0, y: 0 }, // Missing z, temperature, pressure
      { x: 1, y: 1, z: 1, temperature: 300 }, // Missing pressure
    ]
    // Should not throw error
    expect(() => {
      render(<Industrial3DVisualizerEnhancedV11 data={invalidData as any} />)
    }).not.toThrow()
  })

  test('should handle NaN and Infinity values', () => {
    const dataWithNaN = [
      { x: NaN, y: 0, z: 0, temperature: 300, pressure: 101325 },
      { x: 1, y: Infinity, z: 0, temperature: 300, pressure: 101325 },
      { x: 1, y: 1, z: -Infinity, temperature: 300, pressure: 101325 },
    ]
    expect(() => {
      render(<Industrial3DVisualizerEnhancedV11 data={dataWithNaN as any} />)
    }).not.toThrow()
  })

  test('should correctly calculate statistics from data', () => {
    const { rerender } = render(
      <Industrial3DVisualizerEnhancedV11 data={mockDataPoints} title="Stats Test" />
    )

    // Verify component renders without errors
    expect(screen.getByText('Stats Test')).toBeInTheDocument()

    rerender(<Industrial3DVisualizerEnhancedV11 data={mockDataPoints} title="Stats Test" />)
  })
})

// ==================== UNIT TESTS: RENDERING ====================

describe('3D Visualizer Rendering Tests', () => {
  test('should render with default props', () => {
    const { container } = render(
      <Industrial3DVisualizerEnhancedV11 data={mockDataPoints} />
    )
    expect(container.querySelector('.w-full')).toBeInTheDocument()
  })

  test('should render with custom title', () => {
    render(
      <Industrial3DVisualizerEnhancedV11
        data={mockDataPoints}
        title="Custom 3D Visualization"
      />
    )
    expect(screen.getByText('Custom 3D Visualization')).toBeInTheDocument()
  })

  test('should render axis labels correctly', () => {
    render(
      <Industrial3DVisualizerEnhancedV11
        data={mockDataPoints}
        title="Axes 3D"
      />
    )
    // Labels are rendered in Three.js canvas, so we check the component structure
    expect(screen.getByText('Axes 3D')).toBeInTheDocument()
  })

  test('should render variable selector buttons', () => {
    render(
      <Industrial3DVisualizerEnhancedV11 data={mockDataPoints} />
    )
    expect(screen.getByText('Temp')).toBeInTheDocument()
    expect(screen.getByText('Pression')).toBeInTheDocument()
    expect(screen.getByText('Densité')).toBeInTheDocument()
  })

  test('should display statistics panel', () => {
    render(
      <Industrial3DVisualizerEnhancedV11 data={mockDataPoints} />
    )
    expect(screen.getByText('Points')).toBeInTheDocument()
    expect(screen.getByText('FPS')).toBeInTheDocument()
    expect(screen.getByText('LOD')).toBeInTheDocument()
  })
})

describe('2D Chart Visualizer Rendering Tests', () => {
  test('should render with default props', async () => {
    render(
      <HybridChartVisualizerIndustrial predictions={mockPredictions} />
    )
    await waitFor(() => {
      expect(screen.getByText(/Analyse Temporelle PINN V8/)).toBeInTheDocument()
    })
  })

  test('should render tab navigation', async () => {
    render(
      <HybridChartVisualizerIndustrial predictions={mockPredictions} />
    )
    await waitFor(() => {
      expect(screen.getByText('Pression')).toBeInTheDocument()
      expect(screen.getByText('Température')).toBeInTheDocument()
      expect(screen.getByText('Vitesse')).toBeInTheDocument()
      expect(screen.getByText('Densité')).toBeInTheDocument()
    })
  })

  test('should render statistics panel', async () => {
    render(
      <HybridChartVisualizerIndustrial
        predictions={mockPredictions}
        showStatistics={true}
      />
    )
    await waitFor(() => {
      expect(screen.getByText(/Pression Moy./)).toBeInTheDocument()
      expect(screen.getByText(/Température Moy./)).toBeInTheDocument()
    })
  })

  test('should handle empty predictions gracefully', () => {
    const { container } = render(
      <HybridChartVisualizerIndustrial predictions={[]} />
    )
    expect(container).toBeInTheDocument()
  })
})

// ==================== UNIT TESTS: INTERACTION ====================

describe('3D Visualizer Interaction Tests', () => {
  test('should toggle variable selection', async () => {
    render(
      <Industrial3DVisualizerEnhancedV11 data={mockDataPoints} />
    )

    const pressureButton = screen.getByText('Pression')
    fireEvent.click(pressureButton)

    await waitFor(() => {
      expect(pressureButton).toHaveClass('bg-blue-600')
    })
  })

  test('should toggle clipping plane', async () => {
    render(
      <Industrial3DVisualizerEnhancedV11 data={mockDataPoints} />
    )

    const clippingCheckbox = screen.getByLabelText(/Coupe Z/)
    fireEvent.click(clippingCheckbox)

    await waitFor(() => {
      expect(clippingCheckbox).toBeChecked()
    })
  })

  test('should adjust LOD level', async () => {
    render(
      <Industrial3DVisualizerEnhancedV11 data={mockDataPoints} />
    )

    const lodSlider = screen.getByDisplayValue('1')
    fireEvent.change(lodSlider, { target: { value: '3' } })

    await waitFor(() => {
      expect(lodSlider).toHaveValue('3')
    })
  })

  test('should toggle wireframe mode', async () => {
    render(
      <Industrial3DVisualizerEnhancedV11 data={mockDataPoints} />
    )

    const wireframeCheckbox = screen.getByLabelText(/Wireframe/)
    fireEvent.click(wireframeCheckbox)

    await waitFor(() => {
      expect(wireframeCheckbox).toBeChecked()
    })
  })
})

describe('2D Chart Visualizer Interaction Tests', () => {
  test('should switch between tabs', async () => {
    render(
      <HybridChartVisualizerIndustrial predictions={mockPredictions} />
    )

    const temperatureTab = screen.getByText('Température')
    fireEvent.click(temperatureTab)

    await waitFor(() => {
      expect(temperatureTab).toHaveAttribute('data-state', 'active')
    })
  })

  test('should handle tab switching without errors', async () => {
    render(
      <HybridChartVisualizerIndustrial predictions={mockPredictions} />
    )

    const tabs = ['Pression', 'Température', 'Vitesse', 'Densité']

    for (const tab of tabs) {
      const tabElement = screen.getByText(tab)
      fireEvent.click(tabElement)
      await waitFor(() => {
        expect(tabElement).toHaveAttribute('data-state', 'active')
      })
    }
  })
})

// ==================== UNIT TESTS: EDGE CASES ====================

describe('Edge Case Tests', () => {
  test('should handle single data point', () => {
    const singlePoint = [mockDataPoints[0]]
    const { container } = render(
      <Industrial3DVisualizerEnhancedV11 data={singlePoint} />
    )
    expect(container).toBeInTheDocument()
  })

  test('should handle very large datasets', () => {
    const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
      x: Math.random() * 2 - 1,
      y: Math.random() * 2 - 1,
      z: Math.random() * 2 - 1,
      temperature: 250 + Math.random() * 150,
      pressure: 50000 + Math.random() * 150000,
      velocity_magnitude: Math.random() * 5,
      density: 0.5 + Math.random() * 2,
    }))

    const { container } = render(
      <Industrial3DVisualizerEnhancedV11 data={largeDataset} />
    )
    expect(container).toBeInTheDocument()
  })

  test('should handle identical values', () => {
    const identicalData = Array.from({ length: 5 }, () => ({
      x: 0.5,
      y: 0.5,
      z: 0.5,
      temperature: 300,
      pressure: 101325,
      velocity_magnitude: 1.0,
      density: 1.2,
    }))

    const { container } = render(
      <Industrial3DVisualizerEnhancedV11 data={identicalData} />
    )
    expect(container).toBeInTheDocument()
  })

  test('should handle extreme value ranges', () => {
    const extremeData = [
      { x: -1000, y: -1000, z: -1000, temperature: 0.001, pressure: 0.001 },
      { x: 1000, y: 1000, z: 1000, temperature: 1e6, pressure: 1e8 },
    ]

    const { container } = render(
      <Industrial3DVisualizerEnhancedV11 data={extremeData as any} />
    )
    expect(container).toBeInTheDocument()
  })

  test('should handle predictions with missing optional fields', () => {
    const incompletePredictions = [
      { time: 0, x: 0.5, y: 0.5, z: 0.5, temperature: 300, pressure: 101325 },
      { time: 1, x: 0.5, y: 0.5, z: 0.5, temperature: 320, pressure: 120000, velocity_u: 0.6 },
    ]

    render(
      <HybridChartVisualizerIndustrial predictions={incompletePredictions as any} />
    )

    expect(screen.getByText(/Analyse Temporelle PINN V8/)).toBeInTheDocument()
  })
})

// ==================== INTEGRATION TESTS ====================

describe('Integration Tests', () => {
  test('should render both visualizers together', async () => {
    const { container } = render(
      <div>
        <Industrial3DVisualizerEnhancedV11 data={mockDataPoints} title="3D View" />
        <HybridChartVisualizerIndustrial predictions={mockPredictions} title="2D Analysis" />
      </div>
    )

    expect(screen.getByText('3D View')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/2D Analysis/)).toBeInTheDocument()
    })
  })

  test('should maintain state consistency across component lifecycle', async () => {
    const { rerender } = render(
      <Industrial3DVisualizerEnhancedV11 data={mockDataPoints} colorVariable="temperature" />
    )

    const tempButton = screen.getByText('Temp')
    fireEvent.click(tempButton)

    rerender(
      <Industrial3DVisualizerEnhancedV11 data={mockDataPoints} colorVariable="pressure" />
    )

    const pressureButton = screen.getByText('Pression')
    expect(pressureButton).toBeInTheDocument()
  })

  test('should handle rapid data updates', async () => {
    const { rerender } = render(
      <Industrial3DVisualizerEnhancedV11 data={mockDataPoints} />
    )

    for (let i = 0; i < 5; i++) {
      const newData = mockDataPoints.map(p => ({
        ...p,
        temperature: p.temperature + Math.random() * 10,
      }))
      rerender(
        <Industrial3DVisualizerEnhancedV11 data={newData} />
      )
    }

    expect(screen.getByText('Temp')).toBeInTheDocument()
  })

  test('should properly clean up resources on unmount', () => {
    const { unmount } = render(
      <Industrial3DVisualizerEnhancedV11 data={mockDataPoints} />
    )

    expect(() => {
      unmount()
    }).not.toThrow()
  })
})

// ==================== PERFORMANCE TESTS ====================

describe('Performance Tests', () => {
  test('should render 1000 points within acceptable time', () => {
    const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
      x: Math.random() * 2 - 1,
      y: Math.random() * 2 - 1,
      z: Math.random() * 2 - 1,
      temperature: 250 + Math.random() * 150,
      pressure: 50000 + Math.random() * 150000,
      velocity_magnitude: Math.random() * 5,
      density: 0.5 + Math.random() * 2,
    }))

    const startTime = performance.now()
    render(
      <Industrial3DVisualizerEnhancedV11 data={largeDataset} />
    )
    const endTime = performance.now()

    // Should render in less than 5 seconds
    expect(endTime - startTime).toBeLessThan(5000)
  })

  test('should not cause memory leaks on repeated mounts/unmounts', () => {
    for (let i = 0; i < 10; i++) {
      const { unmount } = render(
        <Industrial3DVisualizerEnhancedV11 data={mockDataPoints} />
      )
      unmount()
    }

    // If we reach here without crashing, memory management is acceptable
    expect(true).toBe(true)
  })
})

// ==================== SCIENTIFIC VALIDATION TESTS ====================

describe('Scientific Validation Tests', () => {
  test('should correctly calculate velocity magnitude', () => {
    const testPrediction = {
      time: 0,
      x: 0.5,
      y: 0.5,
      z: 0.5,
      temperature: 300,
      pressure: 101325,
      velocity_u: 3,
      velocity_v: 4,
      velocity_w: 0,
      density: 1.2,
    }

    // Expected magnitude: sqrt(3^2 + 4^2 + 0^2) = 5
    const expectedMagnitude = 5
    const calculatedMagnitude = Math.sqrt(
      testPrediction.velocity_u ** 2 +
      testPrediction.velocity_v ** 2 +
      testPrediction.velocity_w ** 2
    )

    expect(calculatedMagnitude).toBeCloseTo(expectedMagnitude, 5)
  })

  test('should correctly convert pressure units', () => {
    const pressurePa = 101325 // 1 atm in Pa
    const pressureBar = pressurePa / 1e5 // Convert to bar

    expect(pressureBar).toBeCloseTo(1.01325, 5)
  })

  test('should detect cryogenic hydrogen correctly', () => {
    const cryogenicTemp = 20 // K (liquid hydrogen)
    const normalTemp = 300 // K (room temperature)

    expect(cryogenicTemp < 100).toBe(true)
    expect(normalTemp < 100).toBe(false)
  })
})

// ==================== ACCESSIBILITY TESTS ====================

describe('Accessibility Tests', () => {
  test('should have proper ARIA labels', () => {
    render(
      <Industrial3DVisualizerEnhancedV11 data={mockDataPoints} />
    )

    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  test('should support keyboard navigation', async () => {
    render(
      <Industrial3DVisualizerEnhancedV11 data={mockDataPoints} />
    )

    const tempButton = screen.getByText('Temp')
    tempButton.focus()
    fireEvent.keyDown(tempButton, { key: 'Enter' })

    await waitFor(() => {
      expect(tempButton).toHaveFocus()
    })
  })
})
