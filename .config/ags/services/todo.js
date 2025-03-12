const { GLib } = imports.gi;
import Service from 'resource:///com/github/Aylur/ags/service.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';

class TodoService extends Service {
    static {
        Service.register(
            this,
            { 'updated': [], },
        );
    }

    _todoPath = '';
    _todoList = [];

    refresh(value) {
        this.emit('updated', value);
    }

    connectWidget(widget, callback) {
        this.connect(widget, callback, 'updated');
    }

    get todo_json() {
        return this._todoList;
    }

    _parseMarkdown(markdown) {
        return markdown.split('\n')
            .filter(line => line.startsWith('- [ ] ') || line.startsWith('- [x] '))
            .map(line => {
                const done = line.startsWith('- [x] ');
                const content = line.slice(6).trim();
                return { content, done };
            });
    }

    _save() {
        const markdown = this._todoList.map(todo => 
            `- [${todo.done ? 'x' : ' '}] ${todo.content}`
        ).join('\n');
        Utils.writeFile(markdown, this._todoPath)
            .catch(print);
    }

    add(content) {
        this._todoList.push({ content, done: false });
        this._save();
        this.emit('updated');
    }

    check(index) {
        this._todoList[index].done = true;
        this._save();
        this.emit('updated');
    }

    uncheck(index) {
        this._todoList[index].done = false;
        this._save();
        this.emit('updated');
    }

    remove(index) {
        this._todoList.splice(index, 1);
        this._save();
        this.emit('updated');
    }

    constructor() {
        super();
        this._todoPath = userOptions.asyncGet().etc.todoPath || `${GLib.get_user_state_dir()}/ags/user/todo.md`;
        try {
            const fileContents = Utils.readFile(this._todoPath);
            this._todoList = this._parseMarkdown(fileContents);
        }
        catch {
            Utils.exec(`bash -c 'mkdir -p ${GLib.get_user_cache_dir()}/ags/user'`);
            Utils.exec(`touch ${this._todoPath}`);
            Utils.writeFile("", this._todoPath).then(() => {
                this._todoList = this._parseMarkdown(Utils.readFile(this._todoPath));
            }).catch(print);
        }
    }
}

// The singleton instance
const service = new TodoService();

// Make it global for easy use with cli
globalThis.todo = service;

// Export to use in other modules
export default service;