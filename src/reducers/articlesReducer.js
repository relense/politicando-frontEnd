import { FETCH_ARTICLES, FETCH_NEXT_TEN, GET_ARTICLE } from '../actions/actionTypes';

const initialState = {
    allArticles: [],
    tenArticles: [],
    currentArticle: null
}

export default function articles(state = initialState, action) {
  switch (action.type) {
    case FETCH_ARTICLES:
      return {
        ...state,
        allArticles: action.allArticles
      }

    case FETCH_NEXT_TEN:
      let allArticles = []

      for(let j = 0; j < state.allArticles.length; j++) {
        allArticles.push(state.allArticles[j])
      }

      for(let i = 0; i < action.tenArticles.length; i++) {
        allArticles.push(action.tenArticles[i])
      }

      return {
        ...state,
        allArticles: allArticles
      }
    
    case GET_ARTICLE:
      return {
        ...state,
        currentArticle: action.currentArticle
      }

    default:
      return state;
  }
}
