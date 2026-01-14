import api from './api';

export interface Feedback {
    _id: string;
    user: {
        _id: string;
        name: string;
        email: string;
    };
    content: string;
    reply?: string;
    isReplied: boolean;
    createdAt: string;
    updatedAt: string;
}

export const feedbackService = {
    create: async (content: string): Promise<Feedback> => {
        const response = await api.post('/feedback', { content });
        return response.data;
    },

    getMyFeedback: async (page: number = 1, limit: number = 10): Promise<{ feedbacks: Feedback[], total: number, totalPages: number }> => {
        const response = await api.get('/feedback', { params: { page, limit } });
        return response.data;
    },

    getAllFeedback: async (page: number = 1, limit: number = 10): Promise<{ feedbacks: Feedback[], total: number, totalPages: number }> => {
        const response = await api.get('/feedback/all', { params: { page, limit } });
        return response.data;
    },

    reply: async (feedbackId: string, responseContent: string): Promise<Feedback> => {
        const response = await api.post(`/feedback/${feedbackId}/reply`, { response: responseContent });
        return response.data;
    },
};
