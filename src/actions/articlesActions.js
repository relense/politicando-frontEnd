import * as types from './actionTypes';
import { apiUrls } from '../api/apiUrls';
import { get } from '../api/Api';

export function receivedArticles(articles) {
    return {
        type: types.FETCH_ARTICLES,
        all_articles: articles
    }
}

export const loadArticles = () => {
    return async function(dispatch){
        try {
            const response = await get(apiUrls.getNews)
            dispatch(receivedArticles(response))
        } catch (error) {
            console.log(error)
        }
    }
}
