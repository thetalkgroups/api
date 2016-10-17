export const update = <a extends { [key: string]:any }, b extends { [key: string]:any }>(keys: string[]) => (obj: a) => (mapper: <c, d>(value: c, key: string) => d): b =>
    keys.map(key => ({ key, value: obj[key]}))
        .map(({ key, value }) => ({ key, value: mapper(value, key)}))
        .reduce((obj, { key, value }) => {
            obj[key] = value;

            return obj
        }, {} as b);

export const updateAll = <a,b>(obj: a) => update<a,b>(Object.keys(obj))(obj);