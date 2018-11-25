import React, { Component } from 'react';
import { connect } from 'react-redux';
import moment from 'moment'
import './LatestNewsSingleContainer.css';
import { asyncChangeView } from '../../actions/viewActions';
import { asyncChangeCurrentPartie, asyncGetPartieNews } from '../../actions/partiesActions';
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
      <div className="tags" key={item + index} onClick={() => this.elemFuncs(item)}>{item} |</div>
    ));
  }

  render() {
    const title = <h1 className="lastestNewsSingleContainerTitle selectForbiden">{this.props.article.title}</h1>;
    const time = moment(this.props.article.published_time).format('DD-MM-YYYY | HH:mm');
    const news_url = <a href={"https://" +this.props.article.source} className={"latestNewsDiscussionSource" + checkDarkModeLinks(this.props.darkMode)} target="_blank" rel="noopener noreferrer">{this.props.article.source}</a>;
    const tags = this.getTags(this.props.article.tags);
    const image = this.props.article.image_url ? <img onLoad={this.onLoadImage} src={this.props.article.image_url} className={ this.state.size ? "newsImage" : "newsImageSmaller"} alt="Article" title={this.props.article.title} /> : "";
    const content = this.props.article.content;
    const comments = "382 Comentários";

    return (
      <div className={'latestNewsSingleContainer' + checkDarkMode(this.props.darkMode, true)}>
        <a href={this.props.article.news_url} className={'newsTitle' + checkDarkMode(this.props.darkMode, true)}>{title}</a>
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
  }
}

function mapStateToProps(state) {
  return {
    parties: state.parties.partieList,
    darkMode: state.view.darkMode
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
    }
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(LatestNewsSingleContainer);
