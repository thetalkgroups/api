/// <reference path="./user.d.ts" />

interface Question {
    id: string
    user: User
    date: number
    title: string
    question: string
    answers: Answer[]
}

interface Answer {
    user: User
    date: number
    answer: string
}