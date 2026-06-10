import fs from 'node:fs';
import path from 'node:path';
import { parse } from '../packages/core/src/compiler/parse.ts';
import { ssa } from '../packages/core/src/compiler/ssa.ts';
import { optimize } from '../packages/core/src/compiler/optimize.ts';
import { codegen } from '../packages/core/src/compiler/codegen.ts';

const compile = (inputFile: string, outputFile: string, functionName?: string) => {
    console.log(`Starting compilation of ${inputFile}...`);
    const template = fs.readFileSync(inputFile, 'utf-8');
    console.log('Template read. Parsing...');
    const ast = parse(template);
    console.log('AST generated. Running SSA...');
    const instructions = ssa(ast);
    console.log('SSA instructions generated. Optimizing...');
    const optimized = optimize(instructions);
    console.log('Optimized. Generating code...');
    const code = codegen(optimized, functionName);
    console.log('Code generated. Writing to file...');

    const dir = path.dirname(outputFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputFile, code);
    console.log(`Compiled ${inputFile} -> ${outputFile}`);
};

const inputFile = process.argv[2];
const outputFile = process.argv[3];
const functionName = process.argv[4];

if (inputFile && outputFile) {
    const inputPath = path.isAbsolute(inputFile) ? inputFile : path.join(process.cwd(), inputFile);
    const outputPath = path.isAbsolute(outputFile) ? outputFile : path.join(process.cwd(), outputFile);

    if (fs.existsSync(inputPath)) {
        compile(inputPath, outputPath, functionName);
    } else {
        console.error(`Template not found: ${inputPath}`);
    }
} else {
    // Fallback to todo example if no args
    const todoTemplate = path.join(process.cwd(), 'packages/todo-example/src/templates/todo-list.dnr');
    const todoOutput = path.join(process.cwd(), 'packages/todo-example/src/generated/todo-render.ts');

    if (fs.existsSync(todoTemplate)) {
        compile(todoTemplate, todoOutput);
    } else {
        console.error(`Template not found: ${todoTemplate}`);
    }
}
