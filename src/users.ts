import { Db, ObjectID } from "mongodb"

export enum UserStatus {
    ok,
    error,
    banned,
    kicked,
}

export type users = {
    checkUserStatus: (userId: string) => Promise<UserStatus>
    isAdmin: (userId: string) => boolean
    authorizeQuery: (userId: string, query: any) => { "user.id": string }
    setPermission: (userId: string) => (item: { user: User; permission: string; }) => { user: User; permission: string; }
    getUsers(): Promise<{ _id: string, permisison: string, user: User }[]>
    kickUser(prefix: string, itemId: string, kickTime: number): Promise<void>
    banUser(prefix: string, itemId: string): Promise<void>
    unbanUser(id: string): Promise<boolean>
}

export const usersFactory = async (db: Db): Promise<users> => {
    const userCollection = db.collection("users");
    const adminUsers = (await userCollection.find({ permission: "admin" }).toArray())
        .map(user => user._id) as string[];

    const getUsers = () => userCollection.find().toArray() as Promise<{ _id: string, permisison: string, user: User }[]>;

    const updateKickedUsers = async () =>
        await userCollection.remove({ permission: "kicked", releaseTime: { $lte: Date.now() } });
    const getUser = async (prefix: string, itemId: string): Promise<User> => {
        const [ _, group, collection, replys ] = prefix.match(/\/([\w-]+)\/([\w-]+)(?:\/\w+\/(replys))?/);
        const collectionName = group + "-" + collection + (replys ? "-replys" : "");

        return await db.collection(collectionName).findOne({ _id: new ObjectID(itemId) }).then(item => item.user);
    }
    const kickUser = async (prefix: string, itemId: string, kickTime: number) => {
        const user = await getUser(prefix, itemId);

        await userCollection.insertOne({ 
            _id: user.id, 
            permission: "kicked", 
            releaseTime: Date.now() + kickTime, 
            user 
        })
    } 
    const banUser = async (prefix: string, itemId: string) => {
        const user = await getUser(prefix, itemId);

        await userCollection.insertOne({
            _id: user.id,
            permission: "banned",
            user
        })
    }
    const unbanUser = async (id: string) =>
        await userCollection.remove({ _id: id, permission: "banned" })
            .then(result => result.result.n === 1);

    const checkUserStatus = async (userId: string) => {
        if (!userId) {
            return UserStatus.error;
        }

        const bannedUsers = (await userCollection.find({ permission: "banned" }).toArray()) as { _id: string }[];
        const kickedUsers = (await userCollection.find({ permission: "kicked" }).toArray()) as { _id: string }[];
        const userIsBanned = !!bannedUsers.find(user => userId === user._id);
        const userIsKicked = !!kickedUsers.find(user => user._id === userId);

        if (userIsKicked) return UserStatus.kicked;
        if (userIsBanned) return UserStatus.banned;
        return UserStatus.ok;
    };

    const isAdmin = (userId: string) => !!adminUsers.find(id => id === userId)
    const authorizeQuery = (userId: string, query: any) => {
        if (isAdmin(userId)) return query;

        query["user.id"] = userId;

        return query;
    };
    const getPermission = (userId: string, itemId: string) => {
        if ((!!adminUsers.find(id => id == userId))) return "admin";
        if (itemId === userId) return "you";
        return "none";
    };
    const setPermission = (userId: string) => (item: { user: User, permission: string }) => {
        item.permission = getPermission(userId, item.user.id);

        delete item.user.id

        return item;
    };

    return { checkUserStatus, isAdmin, authorizeQuery, setPermission, getUsers, kickUser, banUser, unbanUser }
}
