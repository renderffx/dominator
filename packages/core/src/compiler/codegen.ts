import type { Instruction } from './ssa.ts';

export const codegen = (instructions: Instruction[], functionName = 'render'): string => {
    let code = `import { effect } from '@dominator/core';\n`;
    code += `import * as stateModule from '../state';\n\n`;
    code += `export const ${functionName} = () => {\n`;
    code += '  const state = stateModule;\n';
    code += '  const events = window;\n\n';
    code += '  // Dynamic injection of state into local scope\n';
    code += '  const { currentColor, tool, pixels, history, redoStack, GRID_SIZE, colorCounts, undo, redo, exportToPNG, startDrawing, ifDrawing, stopDrawing, PARTICLE_COUNT, getParticles, frame, mouse, NODE_COUNT, getNodes, fps, opsPerSec, mode, viewport, gridData, TOTAL_ROWS, TOTAL_COLS, selectedCell, stats, perf } = state;\n';

    const generateBlock = (instrs: Instruction[]): string => {
        let blockCode = '';
        for (const ins of instrs) {
            const { op, target, args, nested } = ins;
            switch (op) {
                case 'create':
                    blockCode += `  const ${target} = document.createElement('${args[0]}');\n`;
                    break;
                case 'attr': {
                    const [key, value] = args;
                    if (key.startsWith('style:')) {
                        const styleProp = key.split(':')[1];
                        if (typeof value === 'object' && value.type === 'expr') {
                            blockCode += `  effect(() => { ${target}.style.${styleProp} = ${value}; });\n`;
                        } else {
                            if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
                                const expr = value.slice(1, -1);
                                blockCode += `  effect(() => { ${target}.style.${styleProp} = ${expr}; });\n`;
                            } else {
                                blockCode += `  ${target}.style.${styleProp} = ${JSON.stringify(value)};\n`;
                            }
                        }
                    } else {
                        if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
                            const expr = value.slice(1, -1);
                            blockCode += `  effect(() => { ${target}.setAttribute('${key}', ${expr}); });\n`;
                        } else {
                            blockCode += `  ${target}.setAttribute('${key}', ${JSON.stringify(value)});\n`;
                        }
                    }
                    break;
                }
                case 'event': {
                    const [event, value] = args;
                    if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
                        const handler = value.slice(1, -1);
                        blockCode += `  ${target}.addEventListener('${event}', ${handler});\n`;
                    } else {
                        blockCode += `  ${target}.addEventListener('${event}', events.${value});\n`;
                    }
                    break;
                }
                case 'text':
                    blockCode += `  const ${target} = document.createTextNode(${JSON.stringify(args[0])});\n`;
                    break;
                case 'expr': {
                    const expr = args[0];
                    blockCode += `  const ${target} = document.createTextNode('');\n`;
                    blockCode += `  effect(() => { ${target}.textContent = String(${expr}); });\n`;
                    break;
                }
                case 'append':
                    blockCode += `  ${target}.appendChild(${args[0]});\n`;
                    break;
                case 'each': {
                    const [source, context] = args;
                    blockCode += `  const ${target} = document.createDocumentFragment();\n`;
                    blockCode += `  effect(() => {\n`;
                    blockCode += `      ${target}.textContent = ''; \n`;
                    blockCode += `      (${source} || []).forEach((${context}) => {\n`;
                    if (nested) {
                        blockCode += generateBlock(nested);
                        const created = new Set(nested.filter(i => ['create', 'text', 'expr', 'each'].includes(i.op)).map(i => i.target));
                        const appended = new Set(nested.filter(i => i.op === 'append').map(i => i.args[0]));
                        const roots = Array.from(created).filter(t => !appended.has(t));
                        roots.forEach(r => {
                            blockCode += `        ${target}.appendChild(${r});\n`;
                        });
                    }
                    blockCode += `      });\n`;
                    blockCode += `  });\n`;
                    break;
                }
            }
        }
        return blockCode;
    };

    code += generateBlock(instructions);

    const targets = new Set(instructions.map(i => i.target));
    const children = new Set(instructions.filter(i => i.op === 'append').map(i => i.args[0]));
    const root = Array.from(targets).find(t => !children.has(t));

    code += `  return ${root};\n};`;
    return code;
};
