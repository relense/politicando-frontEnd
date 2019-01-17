import { FETCH_ARTICLES, FETCH_NEXT_TEN, LOADING } from '../actions/actionTypes';

const initialState = {
    allArticles: [],
    tenArticles: [],
    loading: false
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
    
    case LOADING:
      return {
        ...state,
        loading: action.loading
      }
    
    default:
      return state;
  }
}
