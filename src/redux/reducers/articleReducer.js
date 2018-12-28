import { GET_ARTICLE, GET_ARTICLE_COMMENTS, LOADING, SET_COMMENT, SET_EDITOR_INDEX } from '../actions/actionTypes';

const initialState = {
  currentArticle: null,
  currentArticleComments: null,
  enters: 0,
  characters: 0,
  max: 300,
  comment: {},
  loading: false,
  editorIndex: null
}

export default function article(state = initialState, action) {
  switch (action.type) {
    case GET_ARTICLE:
      return {
        ...state,
        currentArticle: action.currentArticle
      }

    case GET_ARTICLE_COMMENTS:
      return {
        ...state,
        currentArticleComments: action.comments
      }

    case SET_COMMENT:
      return {
        ...state,
        comment: action.comment,
        characters: action.characters
      }

    case LOADING:
      return {
        ...state,
        loading: action.loading
      }

    case SET_EDITOR_INDEX:
      return {
        ...state,
        editorIndex: action.editorIndex
      }

    default:
      return state;
  }
}
