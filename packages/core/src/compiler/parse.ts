

export type ASTNodeType =
    | 'Program'
    | 'Element'
    | 'Text'
    | 'Expression'
    | 'Attribute'
    | 'Component'
    | 'Fragment'
    | 'If'
    | 'Each'
    | 'Await'
    | 'Else';

export interface SourceLocation {
    start: { line: number; column: number };
    end: { line: number; column: number };
}

export interface ASTNode {
    type: ASTNodeType;
    tag?: string | Function;
    attributes?: Record<string, any>;
    children?: ASTNode[];
    value?: string | number;
    expression?: string;
    context?: string; // for 'each' blocks (e.g., 'item' in 'each items as item')
    else?: ASTNode;   // for if/else or await/catch
    isStatic?: boolean;
    loc?: SourceLocation;
}

interface Token {
    type: 'tag' | 'text' | 'open' | 'close' | 'selfClose' | 'attr' | 'expr' | 'eof' | 'blockOpen' | 'blockClose' | 'blockCont';
    value: string;
    loc: SourceLocation;
}


class Tokenizer {
    private source: string;
    private pos = 0;
    private line = 1;
    private column = 1;

    constructor(source: string) {
        this.source = source.trim();
    }

    peek(): string {
        return this.source[this.pos] || '';
    }

    advance(): string {
        const char = this.source[this.pos++];
        if (char === '\n') {
            this.line++;
            this.column = 1;
        } else {
            this.column++;
        }
        return char;
    }

    skipWhitespace(): void {
        while (this.pos < this.source.length && /\s/.test(this.peek())) {
            this.advance();
        }
    }

    getLocation(): SourceLocation {
        return {
            start: { line: this.line, column: this.column },
            end: { line: this.line, column: this.column },
        };
    }

    tokenize(): Token[] {
        const tokens: Token[] = [];
        while (this.pos < this.source.length) {
            this.skipWhitespace();

            if (this.peek() === '<') {
                if (this.source[this.pos + 1] === '/') {
                    tokens.push(this.readCloseTag());
                } else {
                    tokens.push(this.readOpenTag());
                }
            } else if (this.peek() === '{') {
                const charAfter = this.source[this.pos + 1];
                if (charAfter === '#' || charAfter === '/' || charAfter === ':') {
                    tokens.push(this.readBlockToken());
                } else {
                    tokens.push(this.readExpression());
                }
            } else {
                tokens.push(this.readText());
            }
        }

        tokens.push({ type: 'eof', value: '', loc: this.getLocation() });
        return tokens;
    }

    private readOpenTag(): Token {
        const loc = this.getLocation();
        this.advance(); // '<'
        this.skipWhitespace();

        let tagName = '';
        while (this.peek() && /[a-zA-Z0-9_-]/.test(this.peek())) {
            tagName += this.advance();
        }

        this.skipWhitespace();

        const attributes: Record<string, any> = {};
        while (this.peek() && this.peek() !== '>' && this.peek() !== '/') {
            const attr = this.readAttribute();
            attributes[attr.name] = attr.value;
            this.skipWhitespace();
        }

        let type: 'open' | 'selfClose' = 'open';
        if (this.peek() === '/') {
            this.advance();
            type = 'selfClose';
        }

        if (this.peek() === '>') this.advance();

        return {
            type,
            value: JSON.stringify({ tag: tagName, attributes }),
            loc,
        };
    }

    private readCloseTag(): Token {
        const loc = this.getLocation();
        this.advance(); // '<'
        this.advance(); // '/'

        let tagName = '';
        while (this.peek() && this.peek() !== '>') {
            tagName += this.advance();
        }

        if (this.peek() === '>') this.advance();

        return { type: 'close', value: tagName.trim(), loc };
    }

    private readAttribute(): { name: string; value: any } {
        let name = '';
        while (this.peek() && /[a-zA-Z0-9_:-]/.test(this.peek())) name += this.advance();

        this.skipWhitespace();

        if (this.peek() !== '=') return { name, value: true };
        this.advance();
        this.skipWhitespace();

        if (this.peek() === '"' || this.peek() === "'") {
            const quote = this.advance();
            let value = '';
            while (this.peek() && this.peek() !== quote) value += this.advance();
            this.advance();
            return { name, value };
        }

        if (this.peek() === '{') {
            this.advance();
            let expr = '';
            let depth = 1;
            while (depth > 0) {
                const char = this.advance();
                if (char === '{') depth++;
                if (char === '}') depth--;
                if (depth > 0) expr += char;
            }
            return { name, value: `{${expr}}` };
        }

        let value = '';
        while (this.peek() && /[a-zA-Z0-9_]/.test(this.peek())) value += this.advance();
        return { name, value };
    }

    private readExpression(): Token {
        const loc = this.getLocation();
        this.advance(); // '{'

        let expr = '';
        let depth = 1;
        while (depth > 0 && this.pos < this.source.length) {
            const char = this.advance();
            if (char === '{') depth++;
            if (char === '}') depth--;
            if (depth > 0) expr += char;
        }

        return { type: 'expr', value: expr.trim(), loc };
    }

    private readText(): Token {
        const loc = this.getLocation();
        let text = '';
        while (this.peek() && this.peek() !== '<' && this.peek() !== '{') text += this.advance();
        return { type: 'text', value: text.trim(), loc };
    }

    private readBlockToken(): Token {
        const loc = this.getLocation();
        this.advance(); // '{'
        const typeChar = this.advance(); // '#', '/', or ':'

        let type: 'blockOpen' | 'blockClose' | 'blockCont';
        if (typeChar === '#') type = 'blockOpen';
        else if (typeChar === '/') type = 'blockClose';
        else type = 'blockCont';

        let content = '';
        while (this.peek() && this.peek() !== '}') {
            content += this.advance();
        }

        if (this.peek() === '}') this.advance();

        return { type, value: content.trim(), loc };
    }
}

export class Parser {
    private tokens: Token[] = [];
    private pos = 0;

    parse(source: string): ASTNode {
        const tokenizer = new Tokenizer(source);
        this.tokens = tokenizer.tokenize();
        this.pos = 0;

        const children = this.parseChildren();
        return { type: 'Program', children };
    }

    private current(): Token {
        return this.tokens[this.pos];
    }

    private advance(): Token {
        return this.tokens[this.pos++];
    }

    private parseChildren(): ASTNode[] {
        const children: ASTNode[] = [];
        while (this.current() && this.current().type !== 'close' && this.current().type !== 'blockClose' && this.current().type !== 'blockCont' && this.current().type !== 'eof') {
            const node = this.parseNode();
            if (node) children.push(node);
        }
        return children;
    }

    private parseNode(): ASTNode | null {
        const token = this.current();
        if (!token) return null;

        if (token.type === 'text') return this.parseText();
        if (token.type === 'expr') return this.parseExpression();
        if (token.type === 'open' || token.type === 'selfClose') return this.parseElement();
        if (token.type === 'blockOpen') return this.parseBlock();
        if (token.type === 'eof') return null;

        this.advance();
        return null;
    }

    private parseText(): ASTNode {
        const token = this.advance();
        return { type: 'Text', value: token.value, isStatic: true, loc: token.loc };
    }

    private parseExpression(): ASTNode {
        const token = this.advance();
        return { type: 'Expression', expression: token.value, isStatic: false, loc: token.loc };
    }

    private parseElement(): ASTNode {
        const token = this.advance();
        const data = JSON.parse(token.value);
        const node: ASTNode = {
            type: /^[A-Z]/.test(data.tag) ? 'Component' : 'Element',
            tag: data.tag,
            attributes: data.attributes,
            loc: token.loc,
        };

        if (token.type === 'selfClose') {
            node.children = [];
            return node;
        }

        node.children = this.parseChildren();
        if (this.current() && this.current().type === 'close') this.advance();
        return node;
    }

    private parseBlock(): ASTNode {
        const token = this.advance(); // blockOpen
        const content = token.value;
        const parts = content.split(/\s+/);
        const tagName = parts[0];

        if (tagName === 'each') {
            // each items as item
            const asIndex = parts.indexOf('as');
            const expression = parts.slice(1, asIndex).join(' ');
            const context = parts.slice(asIndex + 1).join(' ');

            const children = this.parseChildren();

            this.advance(); // Consume blockClose

            return {
                type: 'Each',
                expression,
                context,
                children,
                loc: token.loc
            };
        }

        if (tagName === 'if') {
            const expression = parts.slice(1).join(' ');
            const children = this.parseChildren();

            let elseNode: ASTNode | undefined;
            if (this.current() && this.current().type === 'blockCont' && this.current().value.startsWith('else')) {
                this.advance(); // consume :else
                elseNode = {
                    type: 'Else',
                    children: this.parseChildren()
                };
            }

            this.advance(); // Consume blockClose

            return {
                type: 'If',
                expression,
                children,
                else: elseNode,
                loc: token.loc
            };
        }

        throw new Error(`Unknown block type: ${tagName}`);
    }
}


export function parse(source: string): ASTNode {
    const parser = new Parser();
    return parser.parse(source);
}

export function isStaticNode(node: ASTNode): boolean {
    if (node.type === 'Expression') return false;
    if (['If', 'Each', 'Await', 'Else'].includes(node.type)) return false;
    if (node.type === 'Text') return true;

    if (node.attributes) {
        for (const key in node.attributes) {
            const value = node.attributes[key];
            if (typeof value === 'string' && value.startsWith('{')) return false;
        }
    }

    if (node.children) return node.children.every(child => isStaticNode(child));
    return true;
}
