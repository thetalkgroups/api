/// <reference path="./user.d.ts" />

interface Item {
    _id: string
    user: User
    date?: number
    title: string
    content: { [key: string]: any }
    fields: string[]
    sticky?: boolean
    isYou: boolean
}

interface Reply {
    _id: string
    itemId: string
    user: User
    date: number
    answer: string
    image: string
    isYou: boolean
}