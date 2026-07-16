import React from 'react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';

// Import Prism styles
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Import Prism languages
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import html from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust';
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import toml from 'react-syntax-highlighter/dist/esm/languages/prism/toml';

// Register languages
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('js', javascript);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('ts', typescript);
SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('tsx', tsx);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('py', python);
SyntaxHighlighter.registerLanguage('go', go);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('html', html);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('sh', bash);
SyntaxHighlighter.registerLanguage('rust', rust);
SyntaxHighlighter.registerLanguage('rs', rust);
SyntaxHighlighter.registerLanguage('cpp', cpp);
SyntaxHighlighter.registerLanguage('java', java);
SyntaxHighlighter.registerLanguage('yaml', yaml);
SyntaxHighlighter.registerLanguage('yml', yaml);
SyntaxHighlighter.registerLanguage('toml', toml);

interface CodeViewerProps {
  content: string;
  fileName: string;
}

const getLanguage = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    js: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    py: 'python',
    go: 'go',
    json: 'json',
    html: 'html',
    htm: 'html',
    css: 'css',
    sh: 'bash',
    bash: 'bash',
    bat: 'bash',
    rs: 'rust',
    cpp: 'cpp',
    c: 'cpp',
    h: 'cpp',
    hpp: 'cpp',
    java: 'java',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    ini: 'toml',
  };
  return map[ext] || 'text';
};

export default function CodeViewer({ content, fileName }: CodeViewerProps) {
  const language = getLanguage(fileName);

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#1e1e2e', borderRadius: 12, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      border: '1px solid rgba(255,255,255,0.08)'
    }}>
      {/* Code Header Bar */}
      <div style={{
        padding: '10px 16px', background: 'rgba(30, 30, 30, 0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 500,
        flexShrink: 0
      }}>
        <span>{fileName}</span>
        <span style={{
          textTransform: 'uppercase', background: 'rgba(255,255,255,0.08)',
          padding: '2px 8px', borderRadius: 100, fontSize: 10, letterSpacing: '0.5px'
        }}>
          {language}
        </span>
      </div>
      
      {/* Code Content */}
      <div style={{ flex: 1, overflow: 'auto', background: '#1e1e2e' }}>
        <SyntaxHighlighter
          language={language}
          style={tomorrow}
          showLineNumbers={true}
          customStyle={{
            margin: 0,
            padding: '16px 8px',
            background: 'transparent',
            fontSize: 13,
            lineHeight: 1.6,
            fontFamily: "'Fira Code', Consolas, monospace",
          }}
          codeTagProps={{
            style: {
              fontFamily: "'Fira Code', Consolas, monospace",
            }
          }}
        >
          {content || ''}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
