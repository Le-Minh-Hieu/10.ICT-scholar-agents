import { ZodSchema, ZodObject, ZodArray, ZodBoolean, ZodNumber, ZodString, ZodEnum, ZodOptional, ZodDefault } from 'zod';

// A small, deterministic helper to convert a Zod schema to a Google GenAI tool schema.
// This is not a general-purpose converter and is only designed to work with the schemas
// used in this project.

function unwrapZodType(type: any): any {
    if (type instanceof ZodDefault) {
        return unwrapZodType(type.removeDefault());
    }
    if (type instanceof ZodOptional) {
        return unwrapZodType(type.unwrap());
    }
    return type;
}

function mapZodType(type: any): string {
    type = unwrapZodType(type);
    if (type instanceof ZodString) return 'string';
    if (type instanceof ZodNumber) return 'number';
    if (type instanceof ZodBoolean) return 'boolean';
    if (type instanceof ZodObject) return 'object';
    if (type instanceof ZodArray) return 'array';
    if (type instanceof ZodEnum) return 'string'; 
    return 'any';
}

export function zodToToolSchema(schema: ZodObject<any>): any {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const key in schema.shape) {
        const field = schema.shape[key];
        const unwrappedField = unwrapZodType(field);
        const type = mapZodType(field);
        
        properties[key] = { type };

        if (unwrappedField instanceof ZodEnum) {
            properties[key].enum = unwrappedField.options;
        }

        if (unwrappedField instanceof ZodObject) {
            properties[key] = zodToToolSchema(unwrappedField);
        } else if (unwrappedField instanceof ZodArray) {
            const itemSchema = unwrappedField.element;
            properties[key].items = { type: mapZodType(itemSchema) };
        }

        if (!field.isOptional()) {
            required.push(key);
        }
    }

    return {
        type: 'object',
        properties,
        required,
    };
}
