interface Object {
    mapKeys(obj: any, mapper: (key: string, value: any) => any): any
}

Object.mapKeys = (obj, mapper) =>
    Object.keys(obj).map(key => ({ key, value: mapper(key, obj[key]) })).reduce((obj, { key, value }) => {
        obj[key] = value;

        return obj;
    }, {} as { [key: string]: any})