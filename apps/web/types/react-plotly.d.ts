declare module 'react-plotly.js' {
  import { Component } from 'react';
  import { PlotData, Layout, Config } from 'plotly.js';

  interface PlotParams {
    data: Partial<PlotData>[];
    layout?: Partial<Layout>;
    config?: Partial<Config>;
    frames?: any[];
    onInitialized?: (figure: Readonly<any>, graphDiv: Readonly<HTMLElement>) => void;
    onUpdate?: (figure: Readonly<any>, graphDiv: Readonly<HTMLElement>) => void;
    onPurge?: (figure: Readonly<any>, graphDiv: Readonly<HTMLElement>) => void;
    onError?: (err: Readonly<Error>) => void;
    style?: React.CSSProperties;
    className?: string;
    useResizeHandler?: boolean;
    debug?: boolean;
    revision?: number;
  }

  export default class Plot extends Component<PlotParams> {}
}
