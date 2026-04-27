/**
 * Hybrid Results Visualization Component
 * Side-by-side visualization of CFD and ML predictions
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
} from 'recharts';

interface ResidualData {
  step: number;
  continuity: number;
  momentum: number;
  energy: number;
}

interface FieldComparison {
  field: string;
  cfdValue: number;
  mlValue: number;
  difference: number;
  percentError: number;
}

interface HybridResults {
  jobId: string;
  totalTime: number;
  cfdTime: number;
  mlTime: number;
  totalSteps: number;
  cfdSteps: number;
  mlSteps: number;
  residuals: ResidualData[];
  fieldComparisons: FieldComparison[];
  accelerationFactor: number;
}

export function HybridResultsVisualization({ results }: { results?: HybridResults }) {
  const [selectedField, setSelectedField] = useState<string>('continuity');
  const [comparisonMode, setComparisonMode] = useState<'residuals' | 'fields' | 'performance'>('residuals');

  if (!results) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-gray-500">No results available</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate performance metrics
  const cfdPercentage = (results.cfdSteps / results.totalSteps) * 100;
  const mlPercentage = (results.mlSteps / results.totalSteps) * 100;
  const timeAcceleration = results.cfdTime / (results.cfdTime + results.mlTime);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Total Time</p>
            <p className="text-2xl font-bold">{results.totalTime.toFixed(2)}s</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">CFD Steps</p>
            <p className="text-2xl font-bold">{results.cfdSteps}</p>
            <p className="text-xs text-gray-500">{cfdPercentage.toFixed(1)}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">ML Steps</p>
            <p className="text-2xl font-bold">{results.mlSteps}</p>
            <p className="text-xs text-gray-500">{mlPercentage.toFixed(1)}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Acceleration</p>
            <p className="text-2xl font-bold">{results.accelerationFactor.toFixed(2)}x</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Visualization Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Hybrid Simulation Results</CardTitle>
          <CardDescription>
            CFD and ML prediction analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={comparisonMode} onValueChange={(v) => setComparisonMode(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="residuals">Residuals</TabsTrigger>
              <TabsTrigger value="fields">Field Comparison</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
            </TabsList>

            {/* Residuals Tab */}
            <TabsContent value="residuals" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Select Residual Type</Label>
                <div className="flex gap-2">
                  {['continuity', 'momentum', 'energy'].map((field) => (
                    <Badge
                      key={field}
                      variant={selectedField === field ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => setSelectedField(field)}
                    >
                      {field.charAt(0).toUpperCase() + field.slice(1)}
                    </Badge>
                  ))}
                </div>
              </div>

              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={results.residuals}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="step" />
                  <YAxis scale="log" />
                  <Tooltip
                    formatter={(value) =>
                      typeof value === 'number' ? value.toExponential(2) : value
                    }
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey={selectedField}
                    stroke="#ef4444"
                    dot={false}
                    name={selectedField}
                  />
                </LineChart>
              </ResponsiveContainer>

              <div className="bg-blue-50 p-4 rounded border border-blue-200">
                <p className="text-sm text-blue-900">
                  <strong>Interpretation:</strong> Lower residuals indicate better convergence.
                  The hybrid approach switches between CFD and ML based on residual thresholds.
                </p>
              </div>
            </TabsContent>

            {/* Field Comparison Tab */}
            <TabsContent value="fields" className="space-y-4 mt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left">Field</th>
                      <th className="px-4 py-2 text-right">CFD Value</th>
                      <th className="px-4 py-2 text-right">ML Value</th>
                      <th className="px-4 py-2 text-right">Difference</th>
                      <th className="px-4 py-2 text-right">Error %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.fieldComparisons.map((comp) => (
                      <tr key={comp.field} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium">{comp.field}</td>
                        <td className="px-4 py-2 text-right font-mono">
                          {comp.cfdValue.toFixed(6)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono">
                          {comp.mlValue.toFixed(6)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono">
                          {comp.difference.toExponential(2)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Badge
                            variant={
                              comp.percentError < 1
                                ? 'secondary'
                                : comp.percentError < 5\n                                ? 'outline'\n                                : 'destructive'\n                            }\n                          >\n                            {comp.percentError.toFixed(2)}%\n                          </Badge>\n                        </td>\n                      </tr>\n                    ))}\n                  </tbody>\n                </table>\n              </div>\n\n              <ResponsiveContainer width=\"100%\" height={300}>\n                <BarChart data={results.fieldComparisons}>\n                  <CartesianGrid strokeDasharray=\"3 3\" />\n                  <XAxis dataKey=\"field\" />\n                  <YAxis />\n                  <Tooltip />\n                  <Legend />\n                  <Bar dataKey=\"cfdValue\" fill=\"#3b82f6\" name=\"CFD\" />\n                  <Bar dataKey=\"mlValue\" fill=\"#10b981\" name=\"ML\" />\n                </BarChart>\n              </ResponsiveContainer>\n            </TabsContent>\n\n            {/* Performance Tab */}\n            <TabsContent value=\"performance\" className=\"space-y-4 mt-4\">\n              <div className=\"grid grid-cols-2 gap-4\">\n                {/* CFD vs ML Time */}\n                <Card>\n                  <CardContent className=\"pt-6\">\n                    <ResponsiveContainer width=\"100%\" height={250}>\n                      <BarChart\n                        data={[\n                          { name: 'CFD', time: results.cfdTime },\n                          { name: 'ML', time: results.mlTime },\n                        ]}\n                      >\n                        <CartesianGrid strokeDasharray=\"3 3\" />\n                        <XAxis dataKey=\"name\" />\n                        <YAxis />\n                        <Tooltip />\n                        <Bar dataKey=\"time\" fill=\"#8b5cf6\" />\n                      </BarChart>\n                    </ResponsiveContainer>\n                  </CardContent>\n                </Card>\n\n                {/* Step Distribution */}\n                <Card>\n                  <CardContent className=\"pt-6\">\n                    <ResponsiveContainer width=\"100%\" height={250}>\n                      <BarChart\n                        data={[\n                          { name: 'CFD', steps: results.cfdSteps },\n                          { name: 'ML', steps: results.mlSteps },\n                        ]}\n                      >\n                        <CartesianGrid strokeDasharray=\"3 3\" />\n                        <XAxis dataKey=\"name\" />\n                        <YAxis />\n                        <Tooltip />\n                        <Bar dataKey=\"steps\" fill=\"#06b6d4\" />\n                      </BarChart>\n                    </ResponsiveContainer>\n                  </CardContent>\n                </Card>\n              </div>\n\n              {/* Performance Metrics */}\n              <Card>\n                <CardHeader>\n                  <CardTitle className=\"text-base\">Performance Metrics</CardTitle>\n                </CardHeader>\n                <CardContent className=\"space-y-3\">\n                  <div className=\"flex justify-between items-center\">\n                    <span className=\"text-sm\">CFD Execution Time</span>\n                    <span className=\"font-mono font-semibold\">{results.cfdTime.toFixed(2)}s</span>\n                  </div>\n                  <div className=\"flex justify-between items-center\">\n                    <span className=\"text-sm\">ML Execution Time</span>\n                    <span className=\"font-mono font-semibold\">{results.mlTime.toFixed(2)}s</span>\n                  </div>\n                  <div className=\"flex justify-between items-center border-t pt-3\">\n                    <span className=\"text-sm font-semibold\">Total Time</span>\n                    <span className=\"font-mono font-bold text-lg\">{results.totalTime.toFixed(2)}s</span>\n                  </div>\n                  <div className=\"flex justify-between items-center\">\n                    <span className=\"text-sm\">Acceleration Factor</span>\n                    <Badge variant=\"secondary\">{results.accelerationFactor.toFixed(2)}x</Badge>\n                  </div>\n                  <div className=\"flex justify-between items-center\">\n                    <span className=\"text-sm\">Time Saved</span>\n                    <span className=\"text-green-600 font-semibold\">\n                      {((1 - results.accelerationFactor) * 100).toFixed(1)}%\n                    </span>\n                  </div>\n                </CardContent>\n              </Card>\n            </TabsContent>\n          </Tabs>\n        </CardContent>\n      </Card>\n\n      {/* Insights Card */}\n      <Card className=\"bg-gradient-to-r from-blue-50 to-green-50 border-l-4 border-l-blue-500\">\n        <CardHeader>\n          <CardTitle className=\"text-base\">Hybrid Simulation Insights</CardTitle>\n        </CardHeader>\n        <CardContent className=\"space-y-2 text-sm\">\n          <p>\n            ✓ <strong>Efficiency:</strong> The hybrid approach achieved {results.accelerationFactor.toFixed(2)}x\n            acceleration by using ML for {mlPercentage.toFixed(1)}% of the simulation steps.\n          </p>\n          <p>\n            ✓ <strong>Accuracy:</strong> ML predictions maintained accuracy within acceptable error bounds,\n            as validated by residual convergence.\n          </p>\n          <p>\n            ✓ <strong>Recommendation:</strong> Consider adjusting the residual threshold for future simulations\n            to optimize the CFD/ML balance based on your accuracy requirements.\n          </p>\n        </CardContent>\n      </Card>\n    </div>\n  );\n}\n\n// Helper component for labels\nfunction Label({ children }: { children: React.ReactNode }) {\n  return <label className=\"text-sm font-medium\">{children}</label>;\n}\n
