interface Item {
    _id: string
    user: User
    date?: number
    title: string
    content: { [key: string]: any }
    fields: string[]
    sticky?: boolean
    permission: string
}

interface Reply {
    _id: string
    itemId: string
    user: User
    date: number
    answer: string
    image: string
    permission: string
}