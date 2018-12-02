import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Link } from "react-router-dom";
import moment from 'moment'
import './LatestNewsSingleContainer.css';
import { asyncChangeView } from '../../actions/viewActions';
import { asyncChangeCurrentPartie, asyncGetPartieNews } from '../../actions/partiesActions';
import { asyncLoadArticle } from '../../actions/articlesActions';
import { checkDarkMode, checkDarkModeLinks } from '../../utils/CheckDarkMode.js';

class LatestNewsSingleContainer extends Component {
  constructor(props) {
    super(props);
    this.state = {
      size: true
    }
  }

  onLoadImage = ({target: img}) => {
    if (img.naturalWidth <= 467){
      this.setState({
        size: false
      });
    }
  }

  selectPartie = (i) => {
    this.props.changeView("PARTIES");
    this.props.changeCurrentPartie(this.props.parties[i]);
    this.props.getPartieNews(this.props.parties[i].id)
  }

  elemFuncs = (currentElem) => {
    for(var i = 0; i < this.props.parties.length; i++) {
      if (currentElem === this.props.parties[i].party_name) {
        this.selectPartie(i);
        window.scrollTo(0, 0)
        return;
      }
    }
  }

  getTags = (tags) => {
    let divided_tags = tags.split(",")

    return divided_tags.map((item, index) => (
      <Link to={"/"} key={item + index} className={'latestNewsNavLink' + checkDarkMode(this.props.darkMode, true)}><div className="tags" onClick={() => this.elemFuncs(item)}>{item} |</div></Link>
    ));
  }

  render() {
    const article = this.props.article ? this.props.article : this.props.currentArticle;
  
    if(article) {  
      const title = <h1 className="lastestNewsSingleContainerTitle selectForbiden">{article.title}</h1>;
      const time = moment(article.published_time).format('DD-MM-YYYY | HH:mm');
      const news_url = <a href={"https://" + article.source} className={"latestNewsDiscussionSource" + checkDarkModeLinks(this.props.darkMode)} target="_blank" rel="noopener noreferrer">{article.source}</a>;
      const tags = this.getTags(article.tags);
      const image = article.image_url ? <img onLoad={this.onLoadImage} src={article.image_url} className={ this.state.size ? "newsImage" : "newsImageSmaller"} alt="Article" title={article.title} /> : "";
      const content = article.content;
      const comments = <Link to={`/article/${article.id}`} className={'latestNewsNavLink' + checkDarkMode(this.props.darkMode, true)}><div onClick={() => this.props.getArticle(article.id)}>382 Comentários</div></Link>;
        
      return (
        <div className={'latestNewsSingleContainer' + checkDarkMode(this.props.darkMode, true)}>
          <a href={article.news_url} target="_blank" rel="noopener noreferrer" className={'newsTitle' + checkDarkMode(this.props.darkMode, true)}>{title}</a>
          <div className="latestNewsContentContainer">
            {image}
            <div className="selectForbiden">
              {content}
              <div className={this.props.darkMode ? "fadeout fadeoutDarkMode" : "fadeout"}></div>
            </div>
          </div>
          <div className="latestNewsDiscussionContainer">
            {time} | {news_url} | {tags}
            <div className="latestNewsDiscussionContainerLinkContainer">
              <i className="material-icons commentIcons">comment</i>
              <div className="commentContainer">{comments}</div>
            </div>
          </div>
        </div>
      );
    } else {
      return null
    } 
  }
}

function mapStateToProps(state) {
  return {
    parties: state.parties.partieList,
    darkMode: state.view.darkMode,
    currentArticle: state.articles.currentArticle
  };
}

function mapDispatchToProps(dispatch) {
  return {
    changeView: (view) => {
      dispatch(asyncChangeView(view))
    },
    changeCurrentPartie: (partie) => {
      dispatch(asyncChangeCurrentPartie(partie))
    },
    getPartieNews: (partie_id) => {
      dispatch(asyncGetPartieNews(partie_id))
    },
    getArticle: (article_id) => {
      dispatch(asyncLoadArticle(article_id))
    }
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(LatestNewsSingleContainer);
