/**
 * Binary Command System
 * Prefix: 0xAA + command code
 */

export class BinaryCommands {
    static COMMANDS = {
        OPEN_URL: 0x01,      // 0xAA01 → open URL
        VIBRATE: 0x02,       // 0xAA02 → vibrate 200ms
        TAKE_PICTURE: 0x03,  // 0xAA03 → trigger camera capture
        LOCATION: 0x04,      // 0xAA04 → get current location
        SCREEN_ON: 0x05,     // 0xAA05 → turn screen on
        SCREEN_OFF: 0x06,    // 0xAA06 → turn screen off
        CALL_LOG: 0x07,      // 0xAA07 → fetch call log
        SMS_LIST: 0x08,      // 0xAA08 → fetch SMS
        FACTORY_RESET: 0xFF  // 0xAAFF → factory reset with magic string
    };

    /**
     * Create binary command packet
     */
    static createCommand(commandCode, payload = null) {
        const prefix = 0xAA;
        let buffer;

        if (payload) {
            const payloadBytes = typeof payload === 'string' 
                ? new TextEncoder().encode(payload)
                : new Uint8Array(payload);
            
            buffer = new ArrayBuffer(2 + payloadBytes.length);
            const view = new Uint8Array(buffer);
            
            view[0] = prefix;
            view[1] = commandCode;
            view.set(payloadBytes, 2);
        } else {
            buffer = new ArrayBuffer(2);
            const view = new Uint8Array(buffer);
            
            view[0] = prefix;
            view[1] = commandCode;
        }

        return buffer;
    }

    /**
     * Parse binary command
     */
    static parseCommand(buffer) {
        if (buffer.byteLength < 2) return null;
        
        const view = new Uint8Array(buffer);
        
        // Check prefix
        if (view[0] !== 0xAA) return null;
        
        const commandCode = view[1];
        const payload = buffer.byteLength > 2 
            ? buffer.slice(2)
            : null;

        return {
            command: commandCode,
            payload: payload,
            payloadString: payload ? new TextDecoder().decode(payload) : null
        };
    }

    /**
     * Get command name
     */
    static getCommandName(code) {
        const names = Object.keys(this.COMMANDS);
        const values = Object.values(this.COMMANDS);
        const index = values.indexOf(code);
        return index >= 0 ? names[index] : `UNKNOWN_${code.toString(16).toUpperCase()}`;
    }

    /**
     * Create specific commands
     */
    static openUrl(url) {
        return this.createCommand(this.COMMANDS.OPEN_URL, url);
    }

    static vibrate(duration = 200) {
        const payload = new Uint16Array([duration]);
        return this.createCommand(this.COMMANDS.VIBRATE, payload);
    }

    static takePicture() {
        return this.createCommand(this.COMMANDS.TAKE_PICTURE);
    }

    static getLocation() {
        return this.createCommand(this.COMMANDS.LOCATION);
    }

    static factoryReset(deviceId) {
        const magicString = `WIPE#${deviceId}`;
        return this.createCommand(this.COMMANDS.FACTORY_RESET, magicString);
    }
}

/**
 * Command handler for received binary commands
 */
export class CommandHandler {
    constructor() {
        this.handlers = new Map();
        this.setupDefaultHandlers();
    }

    setupDefaultHandlers() {
        // Register default command handlers
        this.register(BinaryCommands.COMMANDS.OPEN_URL, this.handleOpenUrl);
        this.register(BinaryCommands.COMMANDS.VIBRATE, this.handleVibrate);
        this.register(BinaryCommands.COMMANDS.TAKE_PICTURE, this.handleTakePicture);
        this.register(BinaryCommands.COMMANDS.LOCATION, this.handleLocation);
        this.register(BinaryCommands.COMMANDS.FACTORY_RESET, this.handleFactoryReset);
    }

    register(commandCode, handler) {
        this.handlers.set(commandCode, handler);
    }

    async handle(parsedCommand, deviceId, ws) {
        const handler = this.handlers.get(parsedCommand.command);
        if (handler) {
            try {
                await handler(parsedCommand, deviceId, ws);
            } catch (error) {
                console.error(`[Command] Error handling ${BinaryCommands.getCommandName(parsedCommand.command)}:`, error);
            }
        } else {
            console.warn(`[Command] Unknown command: 0x${parsedCommand.command.toString(16).toUpperCase()}`);
        }
    }

    // Default handlers
    handleOpenUrl(command, deviceId, ws) {
        console.log(`[Command] ${deviceId}: Open URL - ${command.payloadString}`);
        // Send to device
    }

    handleVibrate(command, deviceId, ws) {
        const duration = command.payload ? new Uint16Array(command.payload)[0] : 200;
        console.log(`[Command] ${deviceId}: Vibrate ${duration}ms`);
        // Send to device
    }

    handleTakePicture(command, deviceId, ws) {
        console.log(`[Command] ${deviceId}: Take picture`);
        // Send to device
    }

    handleLocation(command, deviceId, ws) {
        console.log(`[Command] ${deviceId}: Get location`);
        // Send to device
    }

    handleFactoryReset(command, deviceId, ws) {
        console.log(`[Command] ${deviceId}: FACTORY RESET REQUEST - ${command.payloadString}`);
        // Validate magic string before proceeding
        if (command.payloadString === `WIPE#${deviceId}`) {
            console.warn(`[Command] EXECUTING FACTORY RESET FOR ${deviceId}`);
            // Send to device
        }
    }
}