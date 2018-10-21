import React, { Component } from 'react';
import { connect } from 'react-redux';
import './LatestNews.css';

class LatestNewsSingleContainer extends Component {
  render() {
    return (
      <div className="latestNewsSingleContainer">
        <h1>News title</h1>
        <div className="latestNewsContentContainer">
          <img src={ require('../../images/example_pic.jpg')} className="newsImage" alt="example pic" />
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Morbi leo urna molestie at elementum eu facilisis sed. Dignissim suspendisse in est ante in nibh mauris. Nibh sit amet commodo nulla facilisi nullam. Nibh ipsum consequat nisl vel pretium lectus quam. Pharetra et ultrices neque ornare aenean euismod elementum. Ut venenatis tellus in metus vulputate eu scelerisque felis imperdiet. Orci eu lobortis elementum nibh tellus molestie nunc. Proin sagittis nisl rhoncus mattis rhoncus. Sed egestas egestas fringilla phasellus faucibus scelerisque. Ante metus dictum at tempor commodo. Vitae justo eget magna fermentum.

            Purus ut faucibus pulvinar elementum integer enim. Dui sapien eget mi proin sed libero enim sed faucibus. Elit pellentesque habitant morbi tristique senectus et. Cras ornare arcu dui vivamus arcu. In massa tempor nec feugiat. In massa tempor nec feugiat nisl pretium fusce id. Nunc faucibus a pellentesque sit. Varius duis at consectetur lorem. Tempor commodo ullamcorper a lacus vestibulum sed arcu non odio. Vulputate ut pharetra sit amet aliquam.

            Volutpat odio facilisis mauris sit amet massa. Curabitur vitae nunc sed velit dignissim sodales ut eu sem. Pretium lectus quam id leo in vitae turpis. Massa enim nec dui nunc mattis enim ut tellus elementum. Egestas maecenas pharetra convallis posuere morbi leo urna molestie. Amet porttitor eget dolor morbi. Sit amet risus nullam eget. Tincidunt eget nullam non nisi est. Risus nullam eget felis eget nunc lobortis mattis aliquam. Nunc sed blandit libero volutpat sed cras ornare arcu dui. Adipiscing at in tellus integer. Nisl purus in mollis nunc sed id semper risus. Mauris sit amet massa vitae tortor condimentum. Nunc congue nisi vitae suscipit tellus mauris a. Consequat semper viverra nam libero justo laoreet sit. Egestas sed sed risus pretium quam vulputate dignissim suspendisse.

            Sapien et ligula ullamcorper malesuada proin. Nisi est sit amet facilisis magna etiam. Fermentum posuere urna nec tincidunt praesent semper feugiat nibh sed. Porta lorem mollis aliquam ut porttitor leo a diam. Amet dictum sit amet justo donec enim diam vulputate. Sed enim ut sem viverra aliquet eget sit. Orci a scelerisque purus semper eget duis at tellus at. Amet consectetur adipiscing elit ut aliquam. Vel pharetra vel turpis nunc eget. Sapien eget mi proin sed libero enim sed. Condimentum mattis pellentesque id nibh tortor id aliquet lectus. Volutpat est velit egestas dui id ornare. In ornare quam viverra orci sagittis eu volutpat.

            Adipiscing elit duis tristique sollicitudin nibh sit. Ultrices tincidunt arcu non sodales neque sodales ut etiam sit. Interdum posuere lorem ipsum dolor sit. Aliquam ultrices sagittis orci a scelerisque purus semper eget duis. Urna cursus eget nunc scelerisque. Sollicitudin tempor id eu nisl nunc mi ipsum faucibus vitae. Lacus viverra vitae congue eu consequat. Velit sed ullamcorper morbi tincidunt ornare massa eget egestas purus. Senectus et netus et malesuada fames. Enim diam vulputate ut pharetra.
          </p>
          <div className="fadeout"></div>
        </div>

        <div className="latestNewsDiscussionContainer">
        </div>

      </div>
    );
  }
}

function mapStateToProps(state) {
  return { };
}

function mapDispatchToProps(dispatch) {
  return { };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(LatestNewsSingleContainer);
