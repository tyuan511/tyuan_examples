import { Terminal } from 'xterm';
import 'xterm/css/xterm.css';
import io from 'socket.io-client';

const socket = io('ws://localhost:7999', {
  transports: ['websocket'],
  path: '/ws',
});
const term = new Terminal();

term.open(document.getElementById('terminal'));

term.onData((data) => {
  socket.emit('input', data);
});

socket.emit('start');

socket.on('connection', () => {
  console.log('client connection');
});

socket.on('output', (data) => {
  term.write(data);
});
