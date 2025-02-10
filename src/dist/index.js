"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const handler = async (event) => {
    const result = event.name ? `Good Job ${event.name}` : `Good Job Musthafa`;
    return result;
};
exports.handler = handler;
