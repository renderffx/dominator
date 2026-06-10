import { addTodo, toggleTodo, deleteTodo } from './state';
import { batch } from '@dominator/core';
// @ts-ignore
import { render } from './generated/todo-render';

const root = document.getElementById('app')!;

const update = () => {
    batch(() => {
        root.innerHTML = '';
        root.appendChild(render());
    });
};

(window as any).addTodo = () => {
    const input = document.getElementById('todo-input') as HTMLInputElement;
    addTodo(input.value);
    input.value = '';
    update();
};

(window as any).toggle = (id: number) => {
    toggleTodo(id);
    update();
};

(window as any).remove = (id: number) => {
    deleteTodo(id);
    update();
};

update();
