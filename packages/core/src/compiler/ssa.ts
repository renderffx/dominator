import type { ASTNode } from './parse.ts';

export interface Instruction {
    op: 'create' | 'attr' | 'event' | 'text' | 'expr' | 'append' | 'each' | 'if';
    target: string;
    args: any[];
    nested?: Instruction[];
}

export const ssa = (ast: ASTNode): Instruction[] => {
    let nextId = 0;

    const serialize = (nodes: ASTNode | ASTNode[], targetList: Instruction[]): string => {
        const nodeList = Array.isArray(nodes) ? nodes : [nodes];
        let lastId = '';

        const process = (node: ASTNode): string => {
            const id = `v${nextId++}`;

            if (node.type === 'Element' || node.type === 'Component') {
                targetList.push({ op: 'create', target: id, args: [node.tag] });
                if (node.attributes) {
                    for (const [key, value] of Object.entries(node.attributes)) {
                        if (key.startsWith('on')) {
                            targetList.push({ op: 'event', target: id, args: [key.slice(2).toLowerCase(), value] });
                        } else {
                            targetList.push({ op: 'attr', target: id, args: [key, value] });
                        }
                    }
                }
                if (node.children) {
                    for (const child of node.children) {
                        const childId = process(child);
                        targetList.push({ op: 'append', target: id, args: [childId] });
                    }
                }
            } else if (node.type === 'Text') {
                targetList.push({ op: 'text', target: id, args: [node.value] });
            } else if (node.type === 'Expression') {
                targetList.push({ op: 'expr', target: id, args: [node.expression] });
            } else if (node.type === 'Each') {
                // Create a nested instruction block for the loop body
                const childInstructions: Instruction[] = [];
                // Recursively serialize children into this new block
                if (node.children) {
                    serialize(node.children, childInstructions);
                }

                // The 'each' instruction holds the logic to render these children multiple times
                targetList.push({
                    op: 'each',
                    target: id,
                    args: [node.expression, node.context],
                    nested: childInstructions
                });
            } else if (node.type === 'If') {
                // Placeholder for If with nested support
                const childInstructions: Instruction[] = [];
                if (node.children) serialize(node.children, childInstructions);
                targetList.push({
                    op: 'if',
                    target: id,
                    args: [node.expression],
                    nested: childInstructions
                });
            } else if (node.type === 'Program') {
                if (node.children) {
                    serialize(node.children, targetList);
                }
            }
            return id;
        };

        for (const node of nodeList) {
            lastId = process(node);
        }
        return lastId;
    };

    const rootInstructions: Instruction[] = [];
    serialize(ast, rootInstructions);
    return rootInstructions;
};
