"use strict";

const chalk = require("chalk");
const gradient = require("gradient-string");

console.log();
console.log(
  gradient(['#a855f7', '#06b6d4', '#3b82f6'])(
    '███╗   ██╗ ██╗  ██╗ ██╗      ██╗   ██╗ ██╗  ██╗'
  )
);
console.log(
  gradient(['#a855f7', '#06b6d4', '#3b82f6'])(
    '████╗  ██║ ██║  ██║ ██║      ╚██╗ ██╔╝ ╚██╗██╔╝'
  )
);
console.log(
  gradient(['#a855f7', '#06b6d4', '#3b82f6'])(
    '██╔██╗ ██║ ███████║ ██║       ╚████╔╝   ╚███╔╝ '
  )
);
console.log(
  gradient(['#a855f7', '#06b6d4', '#3b82f6'])(
    '██║╚██╗██║ ╚════██║ ██║        ╚██╔╝    ██╔██╗ '
  )
);
console.log(
  gradient(['#a855f7', '#06b6d4', '#3b82f6'])(
    '██║ ╚████║      ██║ ███████╗    ██║    ██╔╝ ██╗'
  )
);
console.log(
  gradient(['#a855f7', '#06b6d4', '#3b82f6'])(
    '╚═╝  ╚═══╝      ╚═╝ ╚══════╝    ╚═╝    ╚═╝  ╚═╝'
  )
);
console.log();
console.log(
  chalk.dim('  ') +
  chalk.bold.hex('#a855f7')('N4lyx') +
  chalk.dim(' · ') +
  chalk.hex('#06b6d4')('WhatsApp Web API') +
  chalk.dim(' · ') +
  chalk.hex('#3b82f6')('by N4tzzOfficial')
);
console.log();
console.log(
  chalk.dim('  ') +
  gradient(['#a855f7', '#06b6d4'])('Thanks for using N4lyx — build something great.')
);
console.log(
  chalk.dim('  › ') +
  chalk.dim('github.com/N4tzzOfficial/n4lyx\nJoin Channel!:https://whatsapp.com/channel/0029VbAVYIx5PO0z9LqImz3U & Visit: https://n4tzzofficial.my.id/')
);
console.log();

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));

var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m)
        if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p))
            __createBinding(exports, m, p);
};

var __importDefault = (this && this.__importDefault) || function(mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};

Object.defineProperty(exports, "__esModule", { value: true });
exports.proto = exports.makeWASocket = void 0;

const WAProto_1 = require("../WAProto");
Object.defineProperty(exports, "proto", {
    enumerable: true,
    get: function() {
        return WAProto_1.proto;
    }
});

const Socket_1 = __importDefault(require("./Socket"));
exports.makeWASocket = Socket_1.default;

__exportStar(require("../WAProto"), exports);
__exportStar(require("./Utils"), exports);
__exportStar(require("./Types"), exports);
__exportStar(require("./Store"), exports);
__exportStar(require("./Defaults"), exports);
__exportStar(require("./WABinary"), exports);
__exportStar(require("./WAM"), exports);
__exportStar(require("./WAUSync"), exports);

exports.default = Socket_1.default;